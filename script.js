const { createClient } = supabase
const SUPABASE_URL = 'https://dgoeebzcqjkwbtddgqxv.supabase.co'
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnb2VlYnpjcWprd2J0ZGRncXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMDc0MzEsImV4cCI6MjA3MTU4MzQzMX0.7iJW8gH2G-zEIdf4cLu_NAUXUQb7Y5P-_s8P_yI7AeQ'

const cliente = createClient(SUPABASE_URL, SUPABASE_KEY)

const video = document.getElementById('video')
const statusEl = document.getElementById('status')
const baterPontoBtn = document.getElementById('baterPontoBtn')
let labeledFaceDescriptors

// Carregar modelos da face-api.js
async function carregarModelos() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/lib/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/lib/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/lib/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/lib/models')
  ])
  statusEl.textContent = 'Modelos carregados. Carregando perfis...'
}

// Carregar descritores faciais dos funcionários cadastrados
async function carregarDescritoresFaciais() {
  const { data: funcionarios, error } = await cliente
    .from('funcionarios')
    .select('id, nome, foto_url')
  if (error) {
    console.error('Erro ao buscar funcionários:', error)
    return []
  }

  return Promise.all(
    funcionarios.map(async funcionario => {
      const descriptions = []
      try {
        const img = await faceapi.fetchImage(funcionario.foto_url)
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (detections) {
          descriptions.push(detections.descriptor)
        }
      } catch (e) {
        console.error(`Erro ao processar imagem de ${funcionario.nome}:`, e)
      }
      return new faceapi.LabeledFaceDescriptors(funcionario.nome, descriptions)
    })
  )
}

// Iniciar a aplicação
async function iniciar() {
  await carregarModelos()
  labeledFaceDescriptors = await carregarDescritoresFaciais()
  statusEl.textContent = 'Sistema pronto. Aponte o rosto para a câmera.'
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => (video.srcObject = stream))
    .catch(err => console.error(err))
}

baterPontoBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Reconhecendo...'
  const detections = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (!detections.length) {
    statusEl.textContent = 'Nenhum rosto detectado. Tente novamente.'
    return
  }

  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.55)
  const bestMatch = detections.map(d =>
    faceMatcher.findBestMatch(d.descriptor)
  )[0]

  if (bestMatch && bestMatch.label !== 'unknown') {
    const nomeFuncionario = bestMatch.label
    statusEl.textContent = `Olá, ${nomeFuncionario}! Registrando seu ponto...`
    await registrarPonto(nomeFuncionario)
  } else {
    statusEl.textContent = 'Funcionário não reconhecido. Tente novamente.'
  }
})

async function registrarPonto(nome) {
  try {
    // 1. Buscar o ID do funcionário pelo nome
    const { data: funcData, error: funcError } = await cliente
      .from('funcionarios')
      .select('id')
      .eq('nome', nome)
      .single()
    if (funcError) throw funcError

    const funcionarioId = funcData.id
    const hoje = new Date().toISOString().split('T')[0]
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    // 2. Buscar o registro de ponto de hoje
    const { data: pontoHoje, error: pontoError } = await cliente
      .from('pontos')
      .select('*')
      .eq('funcionario_id', funcionarioId)
      .eq('data', hoje)
      .maybeSingle()
    if (pontoError) throw pontoError

    if (!pontoHoje) {
      // Nenhum registro → registrar ENTRADA
      const { error } = await cliente.from('pontos').insert({
        funcionario_id: funcionarioId,
        data: hoje,
        hora_entrada: horaAtual
      })
      if (error) throw error
      alert(`Entrada registrada às ${horaAtual} para ${nome}.`)
    } else if (!pontoHoje.saida_pausa) {
      // Tem entrada → registrar SAÍDA PAUSA
      const { error } = await cliente
        .from('pontos')
        .update({ saida_pausa: horaAtual })
        .eq('id', pontoHoje.id)
      if (error) throw error
      alert(`Saída para pausa registrada às ${horaAtual} para ${nome}.`)
    } else if (!pontoHoje.volta_pausa) {
      // Tem saída pausa → registrar VOLTA PAUSA
      const { error } = await cliente
        .from('pontos')
        .update({ volta_pausa: horaAtual })
        .eq('id', pontoHoje.id)
      if (error) throw error
      alert(`Volta da pausa registrada às ${horaAtual} para ${nome}.`)
    } else if (!pontoHoje.hora_saida) {
      // Tem volta pausa → registrar SAÍDA FINAL
      const { error } = await cliente
        .from('pontos')
        .update({ hora_saida: horaAtual })
        .eq('id', pontoHoje.id)
      if (error) throw error
      alert(`Saída final registrada às ${horaAtual} para ${nome}.`)
    } else {
      // Já completou os 4 registros
      alert(`${nome}, todos os pontos de hoje já foram registrados.`)
    }
  } catch (error) {
    console.error('Erro ao registrar o ponto:', error)
    alert(`Ocorreu um erro: ${error.message}`)
  } finally {
    statusEl.textContent = 'Sistema pronto.'
  }
}

iniciar()
