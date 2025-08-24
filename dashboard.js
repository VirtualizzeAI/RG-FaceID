const cliente = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)

// Converte "HH:MM:SS" para minutos decimais
function horaParaMinutos(hora) {
  if (!hora) return 0
  const [h, m, s] = hora.split(':').map(Number)
  return h * 60 + m + (s ? s / 60 : 0)
}

// Converte minutos (decimal) para "HH:MM" arredondando segundos para cima
function minutosParaHHMM(minutos) {
  const sinal = minutos < 0 ? '-' : ''
  minutos = Math.abs(minutos)
  let h = Math.floor(minutos / 60) // mudou de const para let
  let m = Math.ceil(minutos % 60) // arredonda sempre para cima
  if (m === 60) {
    m = 0
    h += 1
  }
  return `${sinal}${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}`
}

// Calcula horas trabalhadas subtraindo a pausa
function calcularHoras(horaEntrada, saidaPausa, voltaPausa, horaSaida) {
  if (!horaEntrada || !horaSaida) return 0

  const entradaMin = horaParaMinutos(horaEntrada)
  const saidaMin = horaParaMinutos(horaSaida)

  let total = saidaMin - entradaMin

  if (saidaPausa && voltaPausa) {
    const pausaMin = horaParaMinutos(voltaPausa) - horaParaMinutos(saidaPausa)
    total -= pausaMin
  }

  return total / 60 // retorna em horas decimais
}

// Formata data "YYYY-MM-DD" para "DD/MM/AAAA"
function formatarData(dataStr) {
  const [y, m, d] = dataStr.split('-')
  return `${d}/${m}/${y}`
}

async function carregarDashboard(filtroData = null) {
  try {
    const dashboard = document.getElementById('dashboard')
    dashboard.innerHTML = ''

    // Buscar todos os funcionários
    const { data: funcionarios, error: errorFunc } = await cliente
      .from('funcionarios')
      .select('*')
      .order('nome', { ascending: true })

    if (errorFunc) throw errorFunc

    for (const f of funcionarios) {
      // Buscar todos os pontos do funcionário (ou filtrar por data se fornecida)
      let query = cliente
        .from('pontos')
        .select('data,hora_entrada,saida_pausa,volta_pausa,hora_saida')
        .eq('funcionario_id', f.id)
        .order('data', { ascending: true })

      if (filtroData) {
        query = query.eq('data', filtroData)
      }

      const { data: pontos, error: errorPontos } = await query
      if (errorPontos) throw errorPontos

      // Calcular saldo acumulado de todos os dias exibidos
      let totalMinutosAcumulado = 0
      pontos.forEach(p => {
        totalMinutosAcumulado +=
          calcularHoras(
            p.hora_entrada,
            p.saida_pausa,
            p.volta_pausa,
            p.hora_saida
          ) *
            60 -
          480
      })

      const corAcumulado = totalMinutosAcumulado < 0 ? 'red' : 'green'
      const divFunc = document.createElement('div')
      divFunc.classList.add('funcionario')
      divFunc.innerHTML = `<h2>${
        f.nome
      } - <span style="color:${corAcumulado}">${minutosParaHHMM(
        totalMinutosAcumulado
      )}</span></h2>`

      const divPontos = document.createElement('div')
      divPontos.classList.add('pontos')

      if (!pontos || pontos.length === 0) {
        divPontos.innerHTML = '<p>Nenhum ponto registrado.</p>'
      } else {
        const table = document.createElement('table')
        table.innerHTML = `
          <thead>
            <tr>
              <th>Data</th>
              <th>Entrada</th>
              <th>Saída Pausa</th>
              <th>Volta Pausa</th>
              <th>Saída</th>
              <th>Saldo de Horas</th>
            </tr>
          </thead>
          <tbody>
            ${pontos
              .map(p => {
                const horasDia = calcularHoras(
                  p.hora_entrada,
                  p.saida_pausa,
                  p.volta_pausa,
                  p.hora_saida
                )
                const saldoLinha = (horasDia - 8) * 60 // minutos
                // Se saldo diário for 0, deixa verde
                const corFinal =
                  saldoLinha <= 0
                    ? saldoLinha === 0
                      ? 'green'
                      : 'red'
                    : 'green'
                return `<tr>
                <td>${formatarData(p.data)}</td>
                <td>${p.hora_entrada || '-'}</td>
                <td>${p.saida_pausa || '-'}</td>
                <td>${p.volta_pausa || '-'}</td>
                <td>${p.hora_saida || '-'}</td>
                <td style="color:${corFinal}">${minutosParaHHMM(
                  saldoLinha
                )}</td>
              </tr>`
              })
              .join('')}
          </tbody>
        `
        divPontos.appendChild(table)
      }

      divFunc.appendChild(divPontos)
      dashboard.appendChild(divFunc)

      // Expandir/ocultar pontos ao clicar no funcionário
      divFunc.addEventListener('click', () => {
        divPontos.style.display =
          divPontos.style.display === 'none' ? 'block' : 'none'
      })
    }
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err)
    alert('Erro ao carregar dados do dashboard')
  }
}

// Inicializa dashboard
carregarDashboard()

// Filtro por data
document.getElementById('filtro-data').addEventListener('change', e => {
  carregarDashboard(e.target.value)
})

// Botão de cadastro
document.getElementById('btn-cadastro').addEventListener('click', () => {
  window.location.href = 'cadastro.html'
})
