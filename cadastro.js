const { createClient } = supabase
const SUPABASE_URL = 'https://dgoeebzcqjkwbtddgqxv.supabase.co'
// prettier-ignore
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnb2VlYnpjcWprd2J0ZGRncXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMDc0MzEsImV4cCI6MjA3MTU4MzQzMX0.7iJW8gH2G-zEIdf4cLu_NAUXUQb7Y5P-_s8P_yI7AeQ'

const cliente = createClient(SUPABASE_URL, SUPABASE_KEY)

const video = document.getElementById('video')
const canvas = document.getElementById('canvas')
const fotoPreview = document.getElementById('fotoPreview')
const capturarFotoBtn = document.getElementById('capturarFoto')
const cadastroForm = document.getElementById('cadastroForm')
const statusEl = document.getElementById('status')
let fotoBlob

// Função para limpar nome do arquivo (remove acentos/espaços)
function sanitizeFileName(name) {
  return name
    .normalize('NFD') // remove acentos
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/\s+/g, '_') // troca espaços por _
    .replace(/[^a-zA-Z0-9_.-]/g, '') // só caracteres válidos
}

// Iniciar a webcam
async function iniciarWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    video.srcObject = stream
  } catch (err) {
    console.error('Erro ao acessar a webcam:', err)
    statusEl.textContent = 'Erro ao acessar webcam. Verifique as permissões.'
  }
}

// Evento para capturar a foto
capturarFotoBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  fotoPreview.src = canvas.toDataURL('image/jpeg')
  fotoPreview.style.display = 'block'

  canvas.toBlob(
    blob => {
      fotoBlob = blob
    },
    'image/jpeg',
    0.95
  )
})

// Evento de submit do formulário
cadastroForm.addEventListener('submit', async e => {
  e.preventDefault()
  const nome = document.getElementById('nome').value
  const cargo = document.getElementById('cargo').value

  if (!fotoBlob) {
    alert('Por favor, capture uma foto antes de salvar.')
    return
  }

  statusEl.textContent = 'Enviando dados...'
  document.getElementById('submitBtn').disabled = true

  try {
    // 1. Fazer upload da foto para o Supabase Storage
    const nomeArquivo = `${Date.now()}_${sanitizeFileName(nome)}.jpg`
    const { error: uploadError } = await cliente.storage
      .from('fotos-funcionarios') // bucket
      .upload(nomeArquivo, fotoBlob, {
        contentType: 'image/jpeg'
      })

    if (uploadError) throw uploadError

    // 2. Obter a URL pública da foto
    const { data: urlData } = cliente.storage
      .from('fotos-funcionarios')
      .getPublicUrl(nomeArquivo)

    // 3. Inserir os dados na tabela 'funcionarios'
    const { error: insertError } = await cliente
      .from('funcionarios')
      .insert({ nome, cargo, foto_url: urlData.publicUrl })

    if (insertError) throw insertError

    statusEl.textContent = 'Funcionário cadastrado com sucesso!'
    cadastroForm.reset()
    fotoPreview.style.display = 'none'
  } catch (error) {
    console.error('Erro no cadastro:', error)
    statusEl.textContent = `Erro: ${error.message}`
  } finally {
    document.getElementById('submitBtn').disabled = false
  }
})

iniciarWebcam()
