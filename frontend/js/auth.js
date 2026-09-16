// Funções de autenticação usando Supabase Auth

function initLoginPage() {
    const form = document.getElementById("loginForm");
    const erroEl = document.getElementById("loginErro");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const email = form.email.value.trim();
        const senha = form.senha.value.trim();
        erroEl.style.display = "none";

        if (!email || !senha) {
            erroEl.textContent = "Informe e-mail e senha.";
            erroEl.style.display = "block";
            return;
        }

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: senha,
            });

            if (error) {
                erroEl.textContent = error.message;
                erroEl.style.display = "block";
                return;
            }

            const session = data.session;
            if (!session) {
                erroEl.textContent = "Não foi possível obter sessão de login.";
                erroEl.style.display = "block";
                return;
            }

            const token = session.access_token;
            const user = data.user;

            window.localStorage.setItem(
                "gml_auth",
                JSON.stringify({
                    access_token: token,
                    user: {
                        id: user.id,
                        email: user.email,
                    },
                })
            );

            window.location.href = "dashboard.html";
        } catch (e) {
            console.error(e);
            erroEl.textContent = "Erro inesperado ao fazer login.";
            erroEl.style.display = "block";
        }
    });
}

function getStoredAuth() {
    const raw = window.localStorage.getItem("gml_auth");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function requireAuth() {
    const auth = getStoredAuth();
    if (!auth || !auth.access_token) {
        window.location.href = "login.html";
    }
    return auth;
}

function logout() {
    const supabase = getSupabase();
    supabase.auth.signOut().finally(() => {
        window.localStorage.removeItem("gml_auth");
        window.location.href = "login.html";
    });
}

