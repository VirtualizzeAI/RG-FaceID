const { createClient } = supabase
// Inicializar o cliente Supabase usando o CONFIG
const cliente = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)

// Selecionar o formulário de login
const loginForm = document.getElementById('login-form')

loginForm.addEventListener('submit', async event => {
  event.preventDefault()

  const email = document.getElementById('email-login').value
  const password = document.getElementById('password-login').value

  // Login usando Supabase Auth
  const { data, error } = await cliente.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    alert(`Erro ao fazer login: ${error.message}`)
    console.error('Erro de login:', error)
  } else {
    alert('Login bem-sucedido!')
    console.log('Usuário logado:', data.user)
    window.location.href = 'dashboard.html' // redireciona para outra página
  }
})
