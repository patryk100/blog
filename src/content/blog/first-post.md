---
title: 'Stack Verification'
description: 'Testing Mermaid and Shiki'
pubDate: '2025-12-30'
heroImage: '../../assets/blog-placeholder-1.jpg'
---

## 1. Testing Mermaid (Architecture)
If you see a flow chart below, the plugin is working.

```mermaid
graph TD;
    User-->LoadBalancer;
    LoadBalancer-->K8s_Cluster;
    K8s_Cluster-->Pod_A;
    style K8s_Cluster fill:#f9f,stroke:#333,stroke-width:4px
```
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: security-test
spec:
  containers:
  - name: sec-ctx-demo
    image: busybox
```
