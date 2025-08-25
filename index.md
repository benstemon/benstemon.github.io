---
---

<div class="row">
  <!-- Main content column -->
  <div class="col-md-8">

  [//]: # (Research page)

  ## Recruiting Graduate Students!
  <br>
  **I am recruiting MS and PhD students for August 2026. If you are a postdoc interested in collaborating on fellowship applications, I encourage you to get in touch!**

  {% include section.html %}

  {% capture text %}
  We use genomic, phenotypic, and ecological data to answer questions about adaptation, speciation, convergent evolution, and more, mainly in the emerging model plant genus *Penstemon*.

  {%
    include button.html
    link="research"
    text="Find out more"
    icon="fa-solid fa-arrow-right"
    flip=true
    style="bare"
  %}
  {% endcapture %}

  {%
    include feature.html
    image="images/laevis-bee.jpg"
    link="research"
    title="Research"
    text=text
  %}

  [//]: # (People page)
  {% capture text %}
  **Currently recruiting MS and PhD students.**
  <br>
  **Interested? Get in touch!**

  {%
    include button.html
    link="team"
    text="Meet our team"
    icon="fa-solid fa-arrow-right"
    flip=true
    style="bare"
  %}
  {% endcapture %}

  {%
    include feature.html
    image="images/people/ben.jpg"
    link="people"
    title="People"
    text=text
  %}

  </div>

  <!-- Sidebar column -->
  <div class="col-md-4">
    <div class="card shadow-sm p-3 mb-4">
      <h3 class="h5">Recent iNaturalist Observations</h3>
      <div id="inat-widget">
        <script type="text/javascript"
                src="https://www.inaturalist.org/observations/widget?username=benstemon&limit=5">
        </script>
      </div>
    </div>
  </div>
</div>
