function renderHeaderUsuario() {
    const container = document.getElementById("headerUsuario");
    if (!container) return;

    const auth = getStoredAuth();
    const email = auth?.user?.email || "Usuário";

    container.innerHTML = `
        <div class="header-usuario">
            <div class="header-usuario-info">
                <span class="header-usuario-nome">${email}</span>
            </div>
            <nav class="header-usuario-nav">
                <a href="dashboard.html">Dashboard</a>
                <a href="viaturas.html">Viaturas</a>
                <button type="button" class="btn btn-secondary" id="btnLogout">Sair</button>
            </nav>
        </div>
    `;

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", function () {
            logout();
        });
    }
}


function logout() {
    localStorage.removeItem("auth");
    window.location.href = "login.html";
}

renderHeaderUsuario();


