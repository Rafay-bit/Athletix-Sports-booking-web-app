// auth.js — Login form handler + session management

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect
    const user = sessionStorage.getItem('user');
    if (user) {
        const parsed = JSON.parse(user);
        window.location.href = parsed.role === 'admin' ? '/admin.html' : '/dashboard.html';
        return;
    }

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'AUTHENTICATING...';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                showError(data.error || 'Login failed');
                btn.disabled = false;
                btn.textContent = 'SIGN IN';
                return;
            }

            // Store user session
            sessionStorage.setItem('user', JSON.stringify(data.data));

            // Redirect based on role
            if (data.data.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }

        } catch (err) {
            showError('Connection failed. Is the server running?');
            btn.disabled = false;
            btn.textContent = 'SIGN IN';
        }
    });

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    }
});
