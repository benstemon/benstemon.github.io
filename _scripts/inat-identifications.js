(async function() {
  const username = "benstemon";
  const url = `https://api.inaturalist.org/v1/identifications?user_id=${username}&order=desc&order_by=created_at&per_page=5&own_observation=false`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const listEl = document.querySelector("#inat-identifications .inat-id-list");
    if (!listEl) return;

    // Deduplicate by observation ID
    const uniqueObs = new Map();
    data.results.forEach(id => {
      if (!uniqueObs.has(id.observation.id)) {
        uniqueObs.set(id.observation.id, id);
      }
    });

    // Take first 5 unique identifications
    Array.from(uniqueObs.values()).slice(0,5).forEach(id => {
      const photoUrl = id.observation.photos[0]?.url?.replace('square','medium') || '';
      const scientificName = id.observation.taxon?.name || id.observation.species_guess;

      const li = document.createElement("li");
      li.innerHTML = `
        <a href="https://www.inaturalist.org/observations/${id.observation.id}" class="inat-observation-link">
          ${photoUrl ? `<img src="${photoUrl}" alt="${scientificName}" class="inat-observation-image">` : ''}
          <span class="inat-observation-name">${scientificName}</span>
        </a>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load identifications:", err);
  }
})();
