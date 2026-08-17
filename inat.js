// Pulls Ben's latest iNaturalist identifications directly from the public
// iNaturalist API on every page load — this is a live client-side fetch,
// not a cached/build-time snapshot, so it's as close to real-time as a
// static site can get.
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('inat-feed');
  if (!container) return;

  const API_URL = 'https://api.inaturalist.org/v1/identifications'
    + '?user_login=benstemon'
    + '&current=true'      // only the still-active ID on each observation, not superseded ones
    + '&per_page=10'
    + '&order=desc'
    + '&order_by=created_at';

  fetch(API_URL)
    .then(res => {
      if (!res.ok) throw new Error('iNaturalist API returned ' + res.status);
      return res.json();
    })
    .then(data => {
      // only keep identifications whose observation actually has a photo
      const ids = (data.results || []).filter(
        r => r.observation && r.observation.photos && r.observation.photos.length > 0 && r.taxon
      );

      if (!ids.length) {
        container.innerHTML = '<div class="feature-placeholder"><span class="mono">No recent identifications found</span></div>';
        return;
      }

      // The identifications endpoint returns a stripped-down taxon object
      // with no "name" field -- fetch full taxon records in one batched
      // call (comma-separated IDs) so we actually have species names.
      const taxonIds = [...new Set(ids.map(id => id.taxon.id))];
      const TAXA_URL = 'https://api.inaturalist.org/v1/taxa/' + taxonIds.join(',');

      return fetch(TAXA_URL)
        .then(res => res.json())
        .then(taxaData => {
          const taxonMap = {};
          (taxaData.results || []).forEach(t => { taxonMap[t.id] = t; });

          const cards = ids.map(id => {
            const taxon = taxonMap[id.taxon.id] || {};
            const sciName = taxon.name || 'Unknown species';
            const commonName = taxon.preferred_common_name;
            const photoUrl = id.observation.photos[0].url.replace('square', 'medium');
            const obsUrl = 'https://www.inaturalist.org/observations/' + id.observation.id;

            const date = new Date(id.created_at);
            const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            return `
              <a class="inat-card" href="${obsUrl}" target="_blank" rel="noopener">
                <div class="inat-photo"><img src="${photoUrl}" alt="${sciName}" loading="lazy"></div>
                <div class="inat-meta">
                  <div class="inat-species"><i>${sciName}</i>${commonName ? ` <span class="inat-common">(${commonName})</span>` : ''}</div>
                  <div class="inat-date mono">${dateStr}</div>
                </div>
              </a>`;
          }).join('');

          container.innerHTML = `<div class="inat-grid">${cards}</div>`;
        });
    })
    .catch(err => {
      container.innerHTML = '<div class="feature-placeholder"><span class="mono">Could not load the iNaturalist feed right now</span>Check back later, or visit the profile directly.</div>';
      console.error('iNaturalist feed error:', err);
    });
});
