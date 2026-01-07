
//changes the name displayed on the corner to the user's name when logged in
(async function(){
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('not logged in');
    const data = await res.json();
    const nameEl = document.getElementById('Name');
    if (nameEl && data.name) {
      nameEl.innerHTML = `<a href="/Profile/${data.id}">${data.name}</a>`;
    }
  } catch (e) {
    console.error('Failed to fetch user info:', e);
    
  }
})();
(async function(){
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('not logged in');
    const data = await res.json();
    // If the user is a member of any club (new 'clubs' array) remove the "no club" message and explore button
    const clubs = data && Array.isArray(data.clubs) ? data.clubs : [];
    const inClub = clubs.length > 0 || (typeof data.club === 'string' && data.club.trim() !== '');
    console.log('ClubPortalFeed: user clubs info:', { clubs, club: data && data.club, clubrole: data && data.clubrole, inClub });
    if (inClub) {
      const clubText = document.getElementById('noclub');
      const clubButton = document.getElementById('exploreclubsbutton');
      if (clubText) clubText.remove();
      if (clubButton) clubButton.remove();
    }
  } catch (e) {
    console.error('Failed to fetch user club info:', e);
  }
})();