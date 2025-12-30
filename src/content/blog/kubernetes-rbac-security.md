---
title: 'Hardening Kubernetes RBAC: Beyond the Basics'
description: 'Deep dive into Kubernetes RBAC misconfigurations and how to properly implement least privilege access control'
pubDate: 'Dec 28 2024'
---

Role-Based Access Control (RBAC) is Kubernetes' primary authorization mechanism, yet it remains one of the most commonly misconfigured security controls in production clusters.

## The Problem with Default Permissions

Many organizations deploy workloads with overly permissive service accounts. The default service account in each namespace is automatically mounted to pods, and cluster administrators often grant broad permissions without understanding the blast radius.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
```

## Attack Vector: Service Account Token Abuse

When a pod is compromised, the attacker gains access to the service account token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`. This token can be used to query the Kubernetes API with whatever permissions that service account has been granted.

**Real-world scenario:**
1. Attacker exploits RCE vulnerability in web application
2. Reads mounted service account token
3. Discovers service account has `cluster-admin` privileges
4. Pivots to full cluster compromise

## Defense: Implement Least Privilege

### Disable Auto-mounting
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: secure-app
automountServiceAccountToken: false
```

### Use Namespaced Roles
Prefer `Role` over `ClusterRole` when possible. Scope permissions to specific namespaces.

### Audit Existing Permissions
```bash
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.subjects[].kind=="ServiceAccount") | 
  {binding: .metadata.name, sa: .subjects[].name, role: .roleRef.name}'
```

## Detection with Falco

Monitor for suspicious service account usage:
```yaml
- rule: Unauthorized K8s API Call from Container
  desc: Detect container making unexpected API server calls
  condition: >
    k8s_api_call and container and 
    not k8s.serviceaccount.name in (allowed_serviceaccounts)
  output: >
    Suspicious API call from container 
    (user=%k8s.user.name pod=%k8s.pod.name ns=%k8s.ns)
  priority: WARNING
```

## Best Practices

1. **Never use cluster-admin for workloads**
2. **Create dedicated service accounts per application**
3. **Use Pod Security Standards to enforce automountServiceAccountToken: false**
4. **Regularly audit RBAC bindings**
5. **Implement admission controllers to validate RBAC before deployment**

RBAC is powerful when configured correctly. The key is treating service account tokens as credentials—because that's exactly what they are.
