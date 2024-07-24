---
title: People
nav:
  order: 3
  tooltip: Lab Members
---

# {% include icon.html icon="fa-solid fa-users" %}Stone Lab members


{% include section.html %}
Ben Stone

{% include list.html data="members" component="portrait" filters="role: pi" %}
{% include list.html data="members" component="portrait" filters="role: ^(?!pi$)" %}

