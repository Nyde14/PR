(async function () {
  // extract id from path /Profile/:id
  const parts = window.location.pathname.split('/');
  const id = parts[2];
  if (!id) {
    window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
    return;
  }

  try {
    const res = await fetch(`/api/users/${id}`, { credentials: 'same-origin' });
    if (!res.ok) {
      if (res.status === 404) window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
      else throw new Error('Failed to load profile');
      return;
    }
    const data = await res.json();

    const nameEl = document.getElementById('ProfileName');
    const picEl = document.getElementById('ProfilePicture');
    const bioEl = document.getElementById('ProfileBio');
    const clubEl = document.getElementById('ProfileClub');
    const roleEl = document.getElementById('ProfileRole');
    const editBtn = document.getElementById('EditProfileBtn');

    if (picEl && data.avatar) {
      picEl.style.backgroundImage = `url(${data.avatar})`;
    }
    if (nameEl) nameEl.textContent = data.name || 'Unnamed';
    if (bioEl) bioEl.textContent = data.bio || '';
    if (clubEl) {
      if (Array.isArray(data.clubs) && data.clubs.length) {
        clubEl.textContent = 'Clubs: ' + data.clubs.map(c => c.name).join(', ');
      } else {
        clubEl.textContent = data.club ? `Club: ${data.club}` : '';
      }
    }
    if (roleEl) roleEl.textContent = data.clubrole ? ` | Role: ${data.clubrole}` : '';

    if (data.self) {
      editBtn.style.display = 'inline-block';
    }

  } catch (e) {
    console.error('Profile load error:', e);
    window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
  }
})();
