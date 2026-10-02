// ============================================================
// CLÍNICA INTEGRADA
// Integração com Supabase
// ============================================================

// ---------------- CONFIGURAÇÃO ----------------

const SUPABASE_URL =
  'https://mbyvvponmlbeaniseyux.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_3dNXSnMhGS_sAoYd4Ua3Tw_OrnEyoTy';

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ---------------- CONFIGURAÇÕES ----------------

const PAGE = 8;

let page = 0;
let timer = null;


// ---------------- FUNÇÕES AUXILIARES ----------------

const $ = selector =>
  document.querySelector(selector);


const $$ = selector =>
  document.querySelectorAll(selector);


const esc = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character])
  );


const brl = value =>
  Number(value || 0).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  );


const dt = value => {

  if (!value) return '-';

  return new Date(value).toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  );

};


const dataBR = value => {

  if (!value) return '-';

  return new Date(
    value + 'T00:00:00'
  ).toLocaleDateString('pt-BR');

};


// ---------------- MENSAGENS ----------------

function msg(text, erro = true) {

  const element = $('#msg');

  if (!element) return;

  element.textContent = text;

  element.className =
    erro ? 'erro' : 'ok';

  element.hidden = !text;

}


// ---------------- CONSULTA SUPABASE ----------------

async function run(query) {

  try {

    const {
      data,
      error,
      count
    } = await query;

    if (error) throw error;

    msg('');

    return {
      data,
      count
    };

  } catch (error) {

    console.error(error);

    msg(
      'Erro ao acessar o banco: ' +
      (error.message || 'falha de conexão')
    );

    return {
      data: null,
      count: 0
    };

  }

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

  const [
    pacientes,
    profissionais,
    consultas,
    status,
    receita,
    procedimentos
  ] = await Promise.all([

    run(
      db
        .from('pacientes')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('ativo', true)
    ),

    run(
      db
        .from('profissionais')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('ativo', true)
    ),

    run(
      db
        .from('consultas')
        .select('*', {
          count: 'exact',
          head: true
        })
    ),

    run(
      db
        .from('consultas')
        .select('status')
    ),

    run(
      db
        .from('v_consultas_detalhe')
        .select('valor_total')
        .eq('status', 'Realizada')
    ),

    run(
      db
        .from('consulta_procedimentos')
        .select(`
          quantidade,
          procedimentos (
            nome,
            valor
          )
        `)
    )

  ]);


  // ---------------- STATUS ----------------

  const statusData = {

    Agendada: 0,
    Realizada: 0,
    Cancelada: 0

  };


  (status.data || []).forEach(item => {

    if (
      Object.prototype.hasOwnProperty.call(
        statusData,
        item.status
      )
    ) {

      statusData[item.status]++;

    }

  });


  // ---------------- RECEITA ----------------

  const totalReceita =
    (receita.data || []).reduce(
      (total, item) =>
        total + Number(item.valor_total || 0),
      0
    );


  // ---------------- CARDS ----------------

  $('#cards').innerHTML = [

    [
      'Pacientes ativos',
      pacientes.count ?? 0
    ],

    [
      'Profissionais ativos',
      profissionais.count ?? 0
    ],

    [
      'Consultas',
      consultas.count ?? 0
    ],

    [
      'Agendadas',
      statusData.Agendada
    ],

    [
      'Realizadas',
      statusData.Realizada
    ],

    [
      'Canceladas',
      statusData.Cancelada
    ],

    [
      'Receita realizada',
      brl(totalReceita)
    ]

  ].map(([title, value]) => `

    <div class="card">

      <small>${title}</small>

      <b>${value}</b>

    </div>

  `).join('');


  // ---------------- STATUS ----------------

  $('#statusResumo').innerHTML = `

    <div class="mini-stat">

      <span>Agendadas</span>
      <strong>${statusData.Agendada}</strong>

    </div>

    <div class="mini-stat">

      <span>Realizadas</span>
      <strong>${statusData.Realizada}</strong>

    </div>

    <div class="mini-stat">

      <span>Canceladas</span>
      <strong>${statusData.Cancelada}</strong>

    </div>

  `;


  // ---------------- PROCEDIMENTOS ----------------

  const mapaProcedimentos = {};

  (procedimentos.data || []).forEach(item => {

    const procedimento =
      item.procedimentos;

    if (!procedimento) return;

    const nome = procedimento.nome;

    if (!mapaProcedimentos[nome]) {

      mapaProcedimentos[nome] = {

        quantidade: 0,
        valor: 0

      };

    }

    mapaProcedimentos[nome].quantidade +=
      Number(item.quantidade || 0);

    mapaProcedimentos[nome].valor +=
      Number(procedimento.valor || 0) *
      Number(item.quantidade || 0);

  });


  const rankingProcedimentos =
    Object.entries(mapaProcedimentos)
      .sort(
        (a, b) =>
          b[1].quantidade -
          a[1].quantidade
      )
      .slice(0, 5);


  $('#topProcedimentos').innerHTML =

    rankingProcedimentos.length

      ? rankingProcedimentos.map(
          ([nome, info]) => `

            <tr>

              <td>${esc(nome)}</td>

              <td>${info.quantidade}</td>

              <td>${brl(info.valor)}</td>

            </tr>

          `
        ).join('')

      : `

        <tr>

          <td colspan="3">
            Nenhum procedimento encontrado.
          </td>

        </tr>

      `;


  // ---------------- RECEITA POR ESPECIALIDADE ----------------

  const especialidades =
    await run(

      db
        .from('v_consultas_detalhe')
        .select(
          'especialidade, valor_total'
        )
        .eq(
          'status',
          'Realizada'
        )

    );


  const receitaEspecialidade = {};


  (especialidades.data || []).forEach(item => {

    const nome =
      item.especialidade ||
      'Não informado';

    receitaEspecialidade[nome] =
      (receitaEspecialidade[nome] || 0) +
      Number(item.valor_total || 0);

  });


  const rankingEspecialidades =
    Object.entries(
      receitaEspecialidade
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 5);


  const max =
    Math.max(
      1,
      ...rankingEspecialidades.map(
        item => item[1]
      )
    );


  $('#top').innerHTML =

    rankingEspecialidades.length

      ? rankingEspecialidades.map(
          ([nome, valor]) => `

            <li>

              <i
                style="
                  width:${(valor / max) * 100}%
                "
              ></i>

              <span>
                ${esc(nome)}
              </span>

              <em>
                ${brl(valor)}
              </em>

            </li>

          `
        ).join('')

      : '<li>Sem dados.</li>';

}


// ============================================================
// CONSULTAS
// ============================================================

async function loadConsultas() {

  const busca =
    $('#busca')?.value
      .replace(/[,()%]/g, ' ')
      .trim();

  const status =
    $('#status')?.value;


  let query =
    db
      .from('v_consultas_detalhe')
      .select('*', {
        count: 'exact'
      })
      .order(
        'data_hora',
        {
          ascending: false
        }
      )
      .range(
        page * PAGE,
        page * PAGE + PAGE - 1
      );


  if (busca) {

    query = query.or(

      `paciente.ilike.%${busca}%,` +
      `profissional.ilike.%${busca}%,` +
      `especialidade.ilike.%${busca}%`

    );

  }


  if (status) {

    query =
      query.eq(
        'status',
        status
      );

  }


  const {
    data,
    count
  } = await run(query);


  $('#lista').innerHTML =

    (data || []).length

      ? data.map(item => `

          <tr>

            <td>
              ${dt(item.data_hora)}
            </td>

            <td>
              ${esc(item.paciente)}
            </td>

            <td>

              ${esc(item.profissional)}

              <br>

              <small>
                ${esc(item.especialidade)}
              </small>

            </td>

            <td>

              <span
                class="tag ${esc(item.status)}"
              >
                ${esc(item.status)}
              </span>

            </td>

            <td>
              ${brl(item.valor_total)}
            </td>

            <td>

              <button
                data-id="${item.id_consulta}"
              >
                Detalhes
              </button>

            </td>

          </tr>

        `).join('')

      : `

        <tr>

          <td colspan="6">
            Nenhuma consulta encontrada.
          </td>

        </tr>

      `;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        (count || 0) / PAGE
      )
    );


  $('#pag').textContent =
    `Página ${page + 1} de ${totalPages}`;


  $('#ant').disabled =
    page === 0;


  $('#prox').disabled =
    page + 1 >= totalPages;

}


// ============================================================
// DETALHES DA CONSULTA
// ============================================================

$('#lista').onclick = async event => {

  const button =
    event.target.closest(
      'button[data-id]'
    );

  if (!button) return;


  const id =
    button.dataset.id;


  const [
    consulta,
    procedimentos
  ] = await Promise.all([

    run(
      db
        .from('v_consultas_detalhe')
        .select('*')
        .eq(
          'id_consulta',
          id
        )
        .single()
    ),

    run(
      db
        .from('consulta_procedimentos')
        .select(`
          quantidade,
          procedimentos (
            nome,
            valor
          )
        `)
        .eq(
          'id_consulta',
          id
        )
    )

  ]);


  if (!consulta.data) return;


  const item =
    consulta.data;


  $('#det').innerHTML = `

    <h3>
      Consulta #${item.id_consulta}
    </h3>

    <p>

      <b>Paciente:</b>
      ${esc(item.paciente)}

      <br>

      <b>Profissional:</b>
      ${esc(item.profissional)}

      <br>

      <b>Especialidade:</b>
      ${esc(item.especialidade)}

      <br>

      <b>Data:</b>
      ${dt(item.data_hora)}

      <br>

      <b>Status:</b>
      ${esc(item.status)}

      <br>

      <b>Observações:</b>
      ${esc(item.observacoes || '-')}

    </p>

    <h4>Procedimentos</h4>

    <ul>

      ${
        (procedimentos.data || [])
          .map(p => `

            <li>

              ${p.quantidade}x
              ${esc(p.procedimentos?.nome)}

              -
              ${brl(
                Number(
                  p.procedimentos?.valor || 0
                )
              )}

            </li>

          `)
          .join('')
        ||
        '<li>Nenhum procedimento.</li>'
      }

    </ul>

    <p>

      <b>
        Total:
        ${brl(item.valor_total)}
      </b>

    </p>

  `;


  $('#dlg').showModal();

};


// ============================================================
// PACIENTES
// ============================================================

async function loadPacientes() {

  const busca =
    $('#buscaPaciente')?.value
      .trim();

  const ativo =
    $('#filtroPacienteAtivo')?.value;


  let query =
    db
      .from('pacientes')
      .select('*')
      .order(
        'id_paciente',
        {
          ascending: false
        }
      );


  if (busca) {

    query =
      query.or(
        `nome.ilike.%${busca}%,` +
        `email.ilike.%${busca}%`
      );

  }


  if (ativo !== '') {

    query =
      query.eq(
        'ativo',
        ativo === 'true'
      );

  }


  const {
    data
  } = await run(query);


  $('#pac').innerHTML =

    (data || []).length

      ? data.map(p => `

          <tr>

            <td>
              ${esc(p.nome)}
            </td>

            <td>
              ${dataBR(p.data_nascimento)}
            </td>

            <td>

              ${esc(p.telefone || '-')}

              <br>

              <small>
                ${esc(p.email || '')}
              </small>

            </td>

            <td>

              <span class="tag">

                ${
                  p.ativo
                    ? 'Ativo'
                    : 'Inativo'
                }

              </span>

            </td>

            <td>

              <button
                class="btn-toggle-paciente"
                data-id="${p.id_paciente}"
                data-ativo="${p.ativo}"
              >

                ${
                  p.ativo
                    ? 'Desativar'
                    : 'Ativar'
                }

              </button>

            </td>

          </tr>

        `).join('')

      : `

        <tr>

          <td colspan="5">
            Nenhum paciente encontrado.
          </td>

        </tr>

      `;

}


// ============================================================
// PROFISSIONAIS
// ============================================================

async function loadProfissionais() {

  const busca =
    $('#buscaProfissional')?.value
      .trim();

  const especialidade =
    $('#filtroProfEspecialidade')?.value;

  const ativo =
    $('#filtroProfAtivo')?.value;


  let query =
    db
      .from('profissionais')
      .select(`
        id_profissional,
        nome,
        registro_profissional,
        id_especialidade,
        ativo,
        especialidades (
          nome
        )
      `)
      .order(
        'id_profissional',
        {
          ascending: true
        }
      );


  if (busca) {

    query =
      query.or(
        `nome.ilike.%${busca}%,` +
        `registro_profissional.ilike.%${busca}%`
      );

  }


  if (especialidade) {

    query =
      query.eq(
        'id_especialidade',
        especialidade
      );

  }


  if (ativo !== '') {

    query =
      query.eq(
        'ativo',
        ativo === 'true'
      );

  }


  const {
    data
  } = await run(query);


  $('#prof').innerHTML =

    (data || []).length

      ? data.map(p => `

          <tr>

            <td>
              ${esc(p.nome)}
            </td>

            <td>
              ${esc(p.registro_profissional)}
            </td>

            <td>
              ${esc(
                p.especialidades?.nome ||
                '-'
              )}
            </td>

            <td>

              <span class="tag">

                ${
                  p.ativo
                    ? 'Ativo'
                    : 'Inativo'
                }

              </span>

            </td>

            <td>

              <button
                class="btn-toggle-profissional"
                data-id="${p.id_profissional}"
                data-ativo="${p.ativo}"
              >

                ${
                  p.ativo
                    ? 'Desativar'
                    : 'Ativar'
                }

              </button>

            </td>

          </tr>

        `).join('')

      : `

        <tr>

          <td colspan="5">
            Nenhum profissional encontrado.
          </td>

        </tr>

      `;

}


// ============================================================
// ESPECIALIDADES
// ============================================================

async function loadEspecialidades() {

  const busca =
    $('#buscaEspecialidade')?.value
      .trim();


  let query =
    db
      .from('especialidades')
      .select(`
        id_especialidade,
        nome,
        descricao
      `)
      .order(
        'id_especialidade',
        {
          ascending: true
        }
      );


  if (busca) {

    query =
      query.ilike(
        'nome',
        `%${busca}%`
      );

  }


  const {
    data
  } = await run(query);


  $('#esp').innerHTML =

    (data || []).length

      ? data.map(e => `

          <tr>

            <td>
              ${esc(e.nome)}
            </td>

            <td>
              ${esc(e.descricao)}
            </td>

            <td>

              <button
                class="btn-ver-profissionais"
                data-id="${e.id_especialidade}"
              >
                Ver profissionais
              </button>

            </td>

          </tr>

        `).join('')

      : `

        <tr>

          <td colspan="3">
            Nenhuma especialidade encontrada.
          </td>

        </tr>

      `;


  // Atualiza os selects de especialidade

  const options =
    (data || [])
      .map(e => `

        <option value="${e.id_especialidade}">
          ${esc(e.nome)}
        </option>

      `)
      .join('');


  const filtro =
    $('#filtroProfEspecialidade');

  if (filtro) {

    filtro.innerHTML = `

      <option value="">
        Todas as especialidades
      </option>

      ${options}

    `;

  }


  const select =
    $('#profEspecialidade');

  if (select) {

    select.innerHTML = `

      <option value="">
        Selecione uma especialidade
      </option>

      ${options}

    `;

  }

}


// ============================================================
// PROCEDIMENTOS
// ============================================================

async function loadProcedimentos() {

  const busca =
    $('#buscaProcedimento')?.value
      .trim();

  const ativo =
    $('#filtroProcAtivo')?.value;


  let query =
    db
      .from('procedimentos')
      .select('*')
      .order(
        'id_procedimento',
        {
          ascending: true
        }
      );


  if (busca) {

    query =
      query.or(
        `nome.ilike.%${busca}%,` +
        `descricao.ilike.%${busca}%`
      );

  }


  if (ativo !== '') {

    query =
      query.eq(
        'ativo',
        ativo === 'true'
      );

  }


  const {
    data
  } = await run(query);


  $('#proc').innerHTML =

    (data || []).length

      ? data.map(p => `

          <tr>

            <td>
              ${esc(p.nome)}
            </td>

            <td>
              ${esc(p.descricao)}
            </td>

            <td>
              ${brl(p.valor)}
            </td>

            <td>

              <span class="tag">

                ${
                  p.ativo
                    ? 'Ativo'
                    : 'Inativo'
                }

              </span>

            </td>

            <td>

              <button
                class="btn-toggle-procedimento"
                data-id="${p.id_procedimento}"
                data-ativo="${p.ativo}"
              >

                ${
                  p.ativo
                    ? 'Desativar'
                    : 'Ativar'
                }

              </button>

            </td>

          </tr>

        `).join('')

      : `

        <tr>

          <td colspan="5">
            Nenhum procedimento encontrado.
          </td>

        </tr>

      `;

}


// ============================================================
// CADASTRAR PACIENTE
// ============================================================

$('#formPaciente').onsubmit =
  async event => {

    event.preventDefault();


    const form =
      new FormData(
        event.target
      );


    const nome =
      form.get('nome').trim();


    if (nome.length < 3) {

      msg(
        'Informe o nome completo.'
      );

      return;

    }


    const {
      error
    } = await db
      .from('pacientes')
      .insert({

        nome,

        data_nascimento:
          form.get('nasc'),

        telefone:
          form.get('tel') || null,

        email:
          form.get('email') || null,

        ativo: true

      });


    if (error) {

      msg(
        error.code === '23505'
          ? 'Este e-mail já está cadastrado.'
          : 'Erro ao cadastrar: ' +
            error.message
      );

      return;

    }


    event.target.reset();

    $('#pacienteDlg').close();

    await loadPacientes();

    await loadDashboard();

    msg(
      'Paciente cadastrado com sucesso!',
      false
    );

  };


// ============================================================
// CADASTRAR PROFISSIONAL
// ============================================================

$('#formProfissional').onsubmit =
  async event => {

    event.preventDefault();


    const form =
      new FormData(
        event.target
      );


    const nome =
      form.get('nome').trim();

    const registro =
      form.get('registro').trim();

    const especialidade =
      Number(
        form.get('especialidade')
      );


    if (
      !nome ||
      !registro ||
      !especialidade
    ) {

      msg(
        'Preencha todos os campos.'
      );

      return;

    }


    // Busca o próximo ID

    const ultimo =
      await run(
        db
          .from('profissionais')
          .select(
            'id_profissional'
          )
          .order(
            'id_profissional',
            {
              ascending: false
            }
          )
          .limit(1)
      );


    const novoId =
      (ultimo.data?.[0]
        ?.id_profissional || 0) + 1;


    const {
      error
    } = await db
      .from('profissionais')
      .insert({

        id_profissional:
          novoId,

        nome,

        registro_profissional:
          registro,

        id_especialidade:
          especialidade,

        ativo:
          form.get('ativo') === 'on'

      });


    if (error) {

      msg(
        'Erro ao cadastrar profissional: ' +
        error.message
      );

      return;

    }


    event.target.reset();

    $('#profissionalDlg').close();

    await loadProfissionais();

    await loadDashboard();

    msg(
      'Profissional cadastrado com sucesso!',
      false
    );

  };


// ============================================================
// CADASTRAR ESPECIALIDADE
// ============================================================

$('#formEspecialidade').onsubmit =
  async event => {

    event.preventDefault();


    const form =
      new FormData(
        event.target
      );


    const nome =
      form.get('nome').trim();

    const descricao =
      form.get('descricao').trim();


    if (!nome || !descricao) {

      msg(
        'Preencha todos os campos.'
      );

      return;

    }


    const ultimo =
      await run(
        db
          .from('especialidades')
          .select(
            'id_especialidade'
          )
          .order(
            'id_especialidade',
            {
              ascending: false
            }
          )
          .limit(1)
      );


    const novoId =
      (ultimo.data?.[0]
        ?.id_especialidade || 0) + 1;


    const {
      error
    } = await db
      .from('especialidades')
      .insert({

        id_especialidade:
          novoId,

        nome,

        descricao

      });


    if (error) {

      msg(
        'Erro ao cadastrar especialidade: ' +
        error.message
      );

      return;

    }


    event.target.reset();

    $('#especialidadeDlg').close();

    await loadEspecialidades();

    msg(
      'Especialidade cadastrada com sucesso!',
      false
    );

  };


// ============================================================
// CADASTRAR PROCEDIMENTO
// ============================================================

$('#formProcedimento').onsubmit =
  async event => {

    event.preventDefault();


    const form =
      new FormData(
        event.target
      );


    const nome =
      form.get('nome').trim();

    const descricao =
      form.get('descricao').trim();

    const valor =
      Number(
        form.get('valor')
      );


    if (
      !nome ||
      !descricao ||
      valor < 0
    ) {

      msg(
        'Preencha os dados corretamente.'
      );

      return;

    }


    const ultimo =
      await run(
        db
          .from('procedimentos')
          .select(
            'id_procedimento'
          )
          .order(
            'id_procedimento',
            {
              ascending: false
            }
          )
          .limit(1)
      );


    const novoId =
      (ultimo.data?.[0]
        ?.id_procedimento || 0) + 1;


    const {
      error
    } = await db
      .from('procedimentos')
      .insert({

        id_procedimento:
          novoId,

        nome,

        descricao,

        valor,

        ativo:
          form.get('ativo') === 'on'

      });


    if (error) {

      msg(
        'Erro ao cadastrar procedimento: ' +
        error.message
      );

      return;

    }


    event.target.reset();

    $('#procedimentoDlg').close();

    await loadProcedimentos();

    await loadDashboard();

    msg(
      'Procedimento cadastrado com sucesso!',
      false
    );

  };


// ============================================================
// ATIVAR / DESATIVAR PACIENTE
// ============================================================

$('#pac').onclick = async event => {

  const button =
    event.target.closest(
      '.btn-toggle-paciente'
    );

  if (!button) return;


  const id =
    Number(button.dataset.id);

  const atual =
    button.dataset.ativo === 'true';


  const {
    error
  } = await db
    .from('pacientes')
    .update({
      ativo: !atual
    })
    .eq(
      'id_paciente',
      id
    );


  if (error) {

    msg(
      'Erro ao atualizar paciente: ' +
      error.message
    );

    return;

  }


  await loadPacientes();

  await loadDashboard();

};


// ============================================================
// ATIVAR / DESATIVAR PROFISSIONAL
// ============================================================

$('#prof').onclick = async event => {

  const button =
    event.target.closest(
      '.btn-toggle-profissional'
    );

  if (!button) return;


  const id =
    Number(button.dataset.id);

  const atual =
    button.dataset.ativo === 'true';


  const {
    error
  } = await db
    .from('profissionais')
    .update({
      ativo: !atual
    })
    .eq(
      'id_profissional',
      id
    );


  if (error) {

    msg(
      'Erro ao atualizar profissional: ' +
      error.message
    );

    return;

  }


  await loadProfissionais();

  await loadDashboard();

};


// ============================================================
// ATIVAR / DESATIVAR PROCEDIMENTO
// ============================================================

$('#proc').onclick = async event => {

  const button =
    event.target.closest(
      '.btn-toggle-procedimento'
    );

  if (!button) return;


  const id =
    Number(button.dataset.id);

  const atual =
    button.dataset.ativo === 'true';


  const {
    error
  } = await db
    .from('procedimentos')
    .update({
      ativo: !atual
    })
    .eq(
      'id_procedimento',
      id
    );


  if (error) {

    msg(
      'Erro ao atualizar procedimento: ' +
      error.message
    );

    return;

  }


  await loadProcedimentos();

  await loadDashboard();

};


// ============================================================
// FILTROS
// ============================================================

$('#busca').oninput = () => {

  clearTimeout(timer);

  timer = setTimeout(
    () => {

      page = 0;

      loadConsultas();

    },
    300
  );

};


$('#status').onchange = () => {

  page = 0;

  loadConsultas();

};


$('#buscaPaciente').oninput = () => {

  clearTimeout(timer);

  timer = setTimeout(
    loadPacientes,
    300
  );

};


$('#filtroPacienteAtivo').onchange =
  loadPacientes;


$('#buscaProfissional').oninput = () => {

  clearTimeout(timer);

  timer = setTimeout(
    loadProfissionais,
    300
  );

};


$('#filtroProfEspecialidade').onchange =
  loadProfissionais;


$('#filtroProfAtivo').onchange =
  loadProfissionais;


$('#buscaEspecialidade').oninput = () => {

  clearTimeout(timer);

  timer = setTimeout(
    loadEspecialidades,
    300
  );

};


$('#buscaProcedimento').oninput = () => {

  clearTimeout(timer);

  timer = setTimeout(
    loadProcedimentos,
    300
  );

};


$('#filtroProcAtivo').onchange =
  loadProcedimentos;


// ============================================================
// PAGINAÇÃO
// ============================================================

$('#ant').onclick = () => {

  if (page > 0) {

    page--;

    loadConsultas();

  }

};


$('#prox').onclick = () => {

  page++;

  loadConsultas();

};


// ============================================================
// NAVEGAÇÃO
// ============================================================

const telas = {

  dashboard:
    loadDashboard,

  consultas:
    loadConsultas,

  pacientes:
    loadPacientes,

  profissionais:
    loadProfissionais,

  especialidades:
    loadEspecialidades,

  procedimentos:
    loadProcedimentos

};


$$('nav button').forEach(button => {

  button.onclick = () => {

    $$('nav button').forEach(
      item =>
        item.classList.toggle(
          'on',
          item === button
        )
    );


    $$('main section').forEach(
      section => {

        section.hidden =
          section.id !==
          button.dataset.s;

      }
    );


    const funcao =
      telas[
        button.dataset.s
      ];


    if (funcao) {

      funcao();

    }

  };

});


// ============================================================
// BOTÕES DE ATUALIZAR
// ============================================================

$$('[data-refresh]').forEach(
  button => {

    button.onclick = () => {

      const atual =
        document.querySelector(
          'main section:not([hidden])'
        );


      if (!atual) return;


      const funcao =
        telas[atual.id];


      if (funcao) {

        funcao();

      }

    };

  }
);


// ============================================================
// ABRIR MODAIS
// ============================================================

$$('[data-open]').forEach(
  button => {

    button.onclick = () => {

      const dialog =
        $('#' + button.dataset.open);


      if (dialog) {

        dialog.showModal();

      }

    };

  }
);


// ============================================================
// FECHAR MODAIS
// ============================================================

$$('[data-close]').forEach(
  button => {

    button.onclick = () => {

      const dialog =
        button.closest('dialog');


      if (dialog) {

        dialog.close();

      }

    };

  }
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function init() {

  try {

    await loadDashboard();

    await loadEspecialidades();

  } catch (error) {

    console.error(error);

    msg(
      'Não foi possível carregar o sistema.'
    );

  }

}


init();