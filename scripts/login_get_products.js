async function loginAndGet() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    console.log('Login status', loginRes.status);
    console.log(loginJson);
    if (!loginJson.token) return;
    const token = loginJson.token;
    const prodRes = await fetch('http://localhost:3000/api/productos', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const prods = await prodRes.json();
    console.log('Productos status', prodRes.status);
    console.log(JSON.stringify(prods, null, 2));
  } catch (err) {
    console.error('ERR', err);
  }
}

loginAndGet();
