(async function(){
  // Fetch current user to know memberships
  let myClubs = [];
  try {
    const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (meRes.ok) {
      const me = await meRes.json();
      myClubs = (me.clubs || []).map(c => String(c.id || c));
    }
  } catch (e) {
    console.warn('Could not fetch current user', e);
  }

  async function loadClubs(){
    const res = await fetch('/api/clubs');
    if (!res.ok) return console.error('Failed to fetch clubs');
    const data = await res.json();
    const list = document.getElementById('clublist');
    list.innerHTML = '';
    data.clubs.forEach(club => {
      const li = document.createElement('li');
      li.className = 'club-item';

      const html = `
        <div class="ContentArea club-card" data-id="${club._id}">
          <div class="club-banner" style="background-image: url('${club.banner || "../ApplyClub/ExampleClubBgPic.jpg"}')"></div>
          <div class="clubphoto" style="background-image: url('${club.avatar || "../ApplyClub/ExamoleClubProfilePic.jpg"}')"></div>
          <div class="club-info">
            <h2 class="clubname">${club.name}</h2>
            <p class="club-desc">${(club.description || '').slice(0,200)}</p>
            <div class="club-actions">
              <button class="join-btn">${myClubs.includes(String(club._id)) ? 'Joined' : 'Join'}</button>
              <span class="member-count">${(club.members||[]).length} members</span>
            </div>
          </div>
        </div>
      `;
      li.innerHTML = html;
      list.appendChild(li);
    });

    // attach event listeners
    document.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const card = e.target.closest('.club-card');
        const id = card.dataset.id;
        if (e.target.innerText === 'Joined') return;
        const res = await fetch(`/api/clubs/${id}/join`, { method: 'POST', credentials: 'same-origin' });
        if (res.ok) {
          e.target.innerText = 'Joined';
          e.target.disabled = true;
        } else if (res.status === 401) {
          // redirect to login
          window.location.href = '/Login/Login.html';
        } else {
          const err = await res.json().catch(()=>({message:'Unknown error'}));
          alert('Failed to join: ' + (err.message || 'Unknown'));
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', loadClubs);
})();