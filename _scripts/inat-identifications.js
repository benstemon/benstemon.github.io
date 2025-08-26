(async function() {
  const username = "benstemon";
  const url = `https://api.inaturalist.org/v1/identifications?user_id=${username}&order=desc&order_by=created_at&per_page=5`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const listEl = document.querySelector("#inat-identifications .inat-id-list");
    if (!listEl) return;

    data.results.forEach(id => {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="https://www.inaturalist.org/observations/${id.observation.id}">
          ${id.body || "(no comment)"} on <em>${id.observation.species_guess}</em>
        </a>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load identifications:", err);
  }
})();
