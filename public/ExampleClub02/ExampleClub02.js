(async function(){
  // Optionally, wire this page to real club data by fetching /api/clubs/:id
  // For now, attach join button to call a join endpoint when clicked (requires auth)
  document.getElementById('joinclubbutton').addEventListener('click', async () => {
    // This page is static; if you have an ID replace `"example-club-02-id"` with a real id
    const clubId = this.datasetClubId || 'example-club-02-id';
    try {
      const res = await fetch(`/api/clubs/${clubId}/join`, { method: 'POST', credentials: 'same-origin' });
      if (res.ok) {
        alert('Joined club!');
        document.getElementById('joinclubbutton').innerText = 'Joined';
        document.getElementById('joinclubbutton').disabled = true;
      } else if (res.status === 401) {
        window.location.href = '/Login/Login.html';
      } else {
        const err = await res.json().catch(()=>({message: 'Failed to join'}));
        alert(err.message || 'Failed to join');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to join (network)');
    }
  });
})();