/*
  Basic smoke test for clubs API. Run with:
    node scripts/test_clubs_flow.js
  Ensure server is running.
*/

(async function(){
  const base = 'http://localhost:3000';
  const email = `testuser${Date.now()}@example.com`;
  const password = 'Test1234';

  // register
  let r = await fetch(base + '/api/users/register', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password, name: 'Test User' }) });
  console.log('register', r.status);
  // login
  r = await fetch(base + '/api/auth/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  const token = j.token;
  console.log('login token length', token ? token.length : 'no token');

  // create a club
  r = await fetch(base + '/api/clubs', { method: 'POST', headers: {'content-type':'application/json','authorization':'Bearer '+token}, body: JSON.stringify({ name: 'SmokeTestClub'+Date.now(), description:'test' }) });
  console.log('create club', r.status);
  const club = await r.json().catch(()=>null);
  if(!club) return console.error('create failed', await r.text());
  console.log('club created', club.club && club.club._id);

  // list clubs
  r = await fetch(base + '/api/clubs');
  const list = await r.json();
  console.log('list length', list.clubs.length);

  process.exit(0);
})();