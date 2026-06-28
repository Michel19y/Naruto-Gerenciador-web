// --- FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAbBdc-sRQcz2olK98Y9P2GfVzD6HhoBdQ",
  authDomain: "narutogerenciador.firebaseapp.com",
  projectId: "narutogerenciador",
  storageBucket: "narutogerenciador.firebasestorage.app",
  messagingSenderId: "666018579115",
  appId: "1:666018579115:web:5c554f39d5400a1cf42dee",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- CONSTANTS ---
const COLLECTIONS = ['pontos_guilda', 'pontos_lua', 'pontos_sol', 'treino_sobrevivencia', 'pontos_mensal'];
const ELEMENTOS = ['Fogo', 'Água', 'Vento', 'Terra', 'Relâmpago'];
const SORT_OPTIONS = ['Padrão', 'Mais Barato (Total)', 'Mais Perto de Upar'];

const COL_NAMES = {
  pontos_guilda: 'Guilda',
  pontos_mensal: 'Mensal',
  pontos_lua: 'Lua',
  pontos_sol: 'Sol',
  treino_sobrevivencia: 'Sobrevivência',
  Todos: 'Todos',
};

// --- STATE ---
let allNinjas = [];
let filteredNinjas = [];
let filters = { text: '', estrelas: null, elemento: 'Todos', colecao: 'Todos', sortOrder: 'Padrão' };
let editNinja = null;
let deleteTarget = null;
let addFormState = { elemento: 'Nenhum', colecao: COLLECTIONS[0] };
let editFormState = { elemento: '', colecao: '' };
let filterFormState = Object.assign({}, filters);

// --- DOM ---
const $grid = document.getElementById('cards-grid');
const $loading = document.getElementById('loading');
const $emptyState = document.getElementById('empty-state');
const $emptyMessage = document.getElementById('empty-message');
const $btnClearFilters = document.getElementById('btn-clear-filters');

// --- HELPERS ---
function colName(col) {
  return COL_NAMES[col] || col;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str == null ? '' : str)));
  return d.innerHTML;
}

function enrichNinja(n) {
  const fragAtual = n.fragmentos_atual || 0;
  const fragTotal = n.fragmentos_total || 0;
  const preco = n.preco || 0;
  const faltando = Math.max(0, fragTotal - fragAtual);
  return Object.assign({}, n, { fragmentosFaltando: faltando, custoTotal: faltando * preco });
}

// --- FILTER + SORT ---
function applyFilters() {
  let result = allNinjas.map(enrichNinja);

  if (filters.colecao && filters.colecao !== 'Todos') {
    result = result.filter(function(n) { return n.collection === filters.colecao; });
  }
  if (filters.text.trim()) {
    const lower = filters.text.toLowerCase();
    result = result.filter(function(n) { return (n.ninja || '').toLowerCase().includes(lower); });
  }
  if (filters.estrelas !== null) {
    result = result.filter(function(n) { return n.estrelas === filters.estrelas; });
  }
  if (filters.elemento && filters.elemento !== 'Todos') {
    result = result.filter(function(n) { return n.elemento === filters.elemento; });
  }
  if (filters.sortOrder === 'Mais Barato (Total)') {
    result.sort(function(a, b) { return (a.custoTotal || 0) - (b.custoTotal || 0); });
  } else if (filters.sortOrder === 'Mais Perto de Upar') {
    result.sort(function(a, b) { return (a.fragmentosFaltando || 0) - (b.fragmentosFaltando || 0); });
  }

  filteredNinjas = result;
}

// --- FIREBASE CRUD ---
async function loadNinjas() {
  setLoading(true);
  try {
    const all = [];
    for (let i = 0; i < COLLECTIONS.length; i++) {
      const col = COLLECTIONS[i];
      const snap = await db.collection(col).get();
      snap.forEach(function(d) {
        const data = d.data();
        all.push(Object.assign({}, data, {
          id: d.id,
          collection: col,
          estrelas: data.estrelas != null ? data.estrelas : null,
          elemento: data.elemento || 'Ainda não adicionado',
          fragmentos_total: data.fragmentos_total || 0,
          fragmentos_atual: data.fragmentos_atual || 0,
          preco: data.preco || 0,
        }));
      });
    }
    allNinjas = all;
    applyFilters();
    renderCards();
  } catch (e) {
    console.error('Erro ao carregar ninjas:', e);
    alert('Erro ao carregar dados do Firebase: ' + e.message);
  } finally {
    setLoading(false);
  }
}

async function saveNew(data) {
  const colecao = data.collection;
  await db.collection(colecao).add({
    ninja: data.ninja,
    preco: data.preco,
    fragmentos_atual: data.fragmentos_atual,
    fragmentos_total: data.fragmentos_total,
    saldo: data.saldo,
    estrelas: data.estrelas,
    elemento: data.elemento,
  });
  await loadNinjas();
}

async function saveEdit(oldCol, id, newCol, data) {
  if (newCol !== oldCol) {
    await db.collection(newCol).add(data);
    await db.collection(oldCol).doc(id).delete();
  } else {
    await db.collection(oldCol).doc(id).update(data);
  }
  await loadNinjas();
}

async function deleteNinja(colecao, id) {
  await db.collection(colecao).doc(id).delete();
  await loadNinjas();
}

// --- RENDER ---
function setLoading(show) {
  $loading.classList.toggle('hidden', !show);
  $grid.classList.toggle('hidden', show);
  if (show) $emptyState.classList.add('hidden');
}

function renderCards() {
  $grid.innerHTML = '';

  const hasFilters =
    filters.text ||
    filters.estrelas !== null ||
    (filters.elemento && filters.elemento !== 'Todos') ||
    (filters.colecao && filters.colecao !== 'Todos');

  if (filteredNinjas.length === 0) {
    $emptyState.classList.remove('hidden');
    $emptyMessage.textContent = hasFilters
      ? 'Nenhum ninja encontrado para o filtro atual.'
      : 'Nenhum ninja cadastrado. Adicione um novo ninja!';
    $btnClearFilters.classList.toggle('hidden', !hasFilters);
  } else {
    $emptyState.classList.add('hidden');
    filteredNinjas.forEach(function(n) { $grid.appendChild(createCard(n)); });
  }
}

function starsHtml(n) {
  if (!n) return '<span class="tag">Sem estrelas</span>';
  var s = '';
  for (var i = 0; i < Math.min(n, 5); i++) s += '<i class="fa-solid fa-star"></i>';
  return '<span class="tag tag-stars">' + s + ' ' + n + '</span>';
}

function fmtNum(val) {
  if (val == null) return 'N/A';
  return Number(val).toLocaleString('pt-BR');
}

function createCard(ninja) {
  const preco    = fmtNum(ninja.preco);
  const fragTotal = fmtNum(ninja.fragmentos_total);
  const elemento  = ninja.elemento || 'Nenhum';
  const origem    = colName(ninja.collection);
  const faltando  = fmtNum(ninja.fragmentosFaltando);
  const custo     = ninja.custoTotal != null ? fmtNum(Math.round(ninja.custoTotal)) : 'N/A';

  const card = document.createElement('div');
  card.className = 'ninja-card';
  card.setAttribute('data-col', ninja.collection || '');
  card.innerHTML =
    '<div class="card-header">' +
      '<i class="fa-solid fa-user-ninja card-ninja-icon"></i>' +
      '<span class="card-name">' + escapeHtml(ninja.ninja) + '</span>' +
      '<button class="btn-delete" type="button" title="Excluir">' +
        '<i class="fa-solid fa-trash"></i>' +
      '</button>' +
    '</div>' +
    '<div class="card-tags">' +
      '<span class="col-badge" data-col="' + escapeHtml(ninja.collection || '') + '">' + escapeHtml(origem) + '</span>' +
      starsHtml(ninja.estrelas) +
      '<span class="tag">' + escapeHtml(elemento) + '</span>' +
    '</div>' +
    '<div class="card-stats">' +
      '<div class="stat"><span class="stat-label">Preço</span><span class="stat-value">' + escapeHtml(preco) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Frag. Total</span><span class="stat-value">' + escapeHtml(fragTotal) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Custo Total</span><span class="stat-value">' + escapeHtml(custo) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Faltando</span><span class="stat-value highlight">' + escapeHtml(faltando) + '</span></div>' +
    '</div>';

  card.addEventListener('click', function(e) {
    if (!e.target.closest('.btn-delete')) openEditModal(ninja);
  });

  card.querySelector('.btn-delete').addEventListener('click', function(e) {
    e.stopPropagation();
    openConfirmDelete(ninja);
  });

  return card;
}

// --- OPTION BUTTONS RENDERER ---
function renderOptions(containerId, options, selected, onSelect, displayMap) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  options.forEach(function(opt) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn' + (selected === opt ? ' selected' : '');
    btn.textContent = (displayMap && displayMap[opt]) ? displayMap[opt] : opt;
    btn.addEventListener('click', function() {
      container.querySelectorAll('.option-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      onSelect(opt);
    });
    container.appendChild(btn);
  });
}

// --- ADD MODAL ---
function openAddModal() {
  addFormState = { elemento: 'Nenhum', colecao: COLLECTIONS[0] };
  ['add-ninja', 'add-preco', 'add-frag-total', 'add-frag-falta', 'add-estrelas']
    .forEach(function(id) { document.getElementById(id).value = ''; });
  renderOptions('add-elemento-options', ELEMENTOS, addFormState.elemento, function(v) { addFormState.elemento = v; });
  renderOptions('add-colecao-options', COLLECTIONS, addFormState.colecao, function(v) { addFormState.colecao = v; }, COL_NAMES);
  show('modal-add');
}

async function handleAddSave() {
  const ninja = document.getElementById('add-ninja').value.trim();
  const preco = document.getElementById('add-preco').value;
  const fragTotal = parseInt(document.getElementById('add-frag-total').value) || 0;
  const fragFalta = parseInt(document.getElementById('add-frag-falta').value) || 0;
  const estrelas = document.getElementById('add-estrelas').value;

  if (!ninja || !preco || !fragTotal) {
    alert('Preencha o Nome, Preço e Fragmentos necessários.');
    return;
  }

  try {
    await saveNew({
      ninja: ninja,
      preco: parseInt(preco) || 0,
      fragmentos_atual: Math.max(0, fragTotal - fragFalta),
      fragmentos_total: fragTotal,
      estrelas: estrelas ? parseInt(estrelas) : null,
      elemento: addFormState.elemento,
      collection: addFormState.colecao,
    });
    hide('modal-add');
  } catch (e) {
    console.error(e);
    alert('Erro ao adicionar ninja: ' + e.message);
  }
}

// --- EDIT MODAL ---
function openEditModal(ninja) {
  editNinja = ninja;
  editFormState.elemento = ninja.elemento || 'Ainda não adicionado';
  editFormState.colecao = ninja.collection || COLLECTIONS[0];

  document.getElementById('edit-modal-title').textContent = 'Editar ' + (ninja.ninja || '');
  document.getElementById('edit-ninja').value = ninja.ninja || '';
  document.getElementById('edit-preco').value = ninja.preco != null ? ninja.preco.toString() : '';
  document.getElementById('edit-frag-total').value = ninja.fragmentos_total != null ? ninja.fragmentos_total.toString() : '';
  const fragFaltaEdit = Math.max(0, (ninja.fragmentos_total || 0) - (ninja.fragmentos_atual || 0));
  document.getElementById('edit-frag-falta').value = fragFaltaEdit.toString();
  document.getElementById('edit-estrelas').value = ninja.estrelas != null ? ninja.estrelas.toString() : '';

  renderOptions('edit-elemento-options', ELEMENTOS, editFormState.elemento, function(v) { editFormState.elemento = v; });
  renderOptions('edit-colecao-options', COLLECTIONS, editFormState.colecao, function(v) { editFormState.colecao = v; }, COL_NAMES);
  show('modal-edit');
}

async function handleEditSave() {
  if (!editNinja) return;

  const ninjaName = document.getElementById('edit-ninja').value.trim();
  const preco = document.getElementById('edit-preco').value;
  const fragTotal = parseInt(document.getElementById('edit-frag-total').value) || 0;
  const fragFalta = parseInt(document.getElementById('edit-frag-falta').value) || 0;
  const estrelas = document.getElementById('edit-estrelas').value;

  try {
    await saveEdit(editNinja.collection, editNinja.id, editFormState.colecao, {
      ninja: ninjaName,
      preco: parseInt(preco) || null,
      fragmentos_atual: Math.max(0, fragTotal - fragFalta),
      fragmentos_total: fragTotal,
      estrelas: estrelas ? parseInt(estrelas) : null,
      elemento: editFormState.elemento,
    });
    hide('modal-edit');
    editNinja = null;
  } catch (e) {
    console.error(e);
    alert('Erro ao salvar ninja: ' + e.message);
  }
}

// --- FILTER MODAL ---
function openFilterModal() {
  filterFormState = Object.assign({}, filters);
  document.getElementById('filter-text').value = filterFormState.text;
  document.getElementById('filter-estrelas').value = filterFormState.estrelas != null ? filterFormState.estrelas.toString() : '';

  const filterElementos = ['Todos'].concat(ELEMENTOS);
  const filterColecoes = ['Todos'].concat(COLLECTIONS);

  renderOptions('filter-elemento-options', filterElementos, filterFormState.elemento || 'Todos', function(v) { filterFormState.elemento = v; });
  renderOptions('filter-colecao-options', filterColecoes, filterFormState.colecao || 'Todos', function(v) { filterFormState.colecao = v; }, COL_NAMES);
  renderOptions('filter-sort-options', SORT_OPTIONS, filterFormState.sortOrder, function(v) { filterFormState.sortOrder = v; });
  show('modal-filter');
}

function handleFilterApply() {
  filters.text = document.getElementById('filter-text').value;
  const estrelasVal = document.getElementById('filter-estrelas').value;
  filters.estrelas = estrelasVal ? parseInt(estrelasVal) : null;
  filters.elemento = filterFormState.elemento || 'Todos';
  filters.colecao = filterFormState.colecao || 'Todos';
  filters.sortOrder = filterFormState.sortOrder;

  applyFilters();
  renderCards();
  hide('modal-filter');
}

function clearFilters() {
  filters = { text: '', estrelas: null, elemento: 'Todos', colecao: 'Todos', sortOrder: 'Padrão' };
  applyFilters();
  renderCards();
}

// --- CONFIRM DELETE ---
function openConfirmDelete(ninja) {
  deleteTarget = ninja;
  document.getElementById('confirm-message').textContent =
    'Excluir "' + (ninja.ninja || '') + '" da coleção "' + colName(ninja.collection) + '"? Esta ação é irreversível.';
  show('modal-confirm');
}

async function handleConfirmDelete() {
  if (!deleteTarget) return;
  const id = deleteTarget.id;
  const col = deleteTarget.collection;
  hide('modal-confirm');
  deleteTarget = null;
  try {
    await deleteNinja(col, id);
  } catch (e) {
    console.error(e);
    alert('Erro ao excluir ninja: ' + e.message);
  }
}

// --- MODAL HELPERS ---
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// --- EVENT LISTENERS ---
document.getElementById('btn-add').addEventListener('click', openAddModal);
document.getElementById('btn-filter').addEventListener('click', openFilterModal);
document.getElementById('btn-refresh').addEventListener('click', loadNinjas);
document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

document.getElementById('btn-add-save').addEventListener('click', handleAddSave);
document.getElementById('btn-add-cancel').addEventListener('click', function() { hide('modal-add'); });

document.getElementById('btn-edit-save').addEventListener('click', handleEditSave);
document.getElementById('btn-edit-cancel').addEventListener('click', function() { hide('modal-edit'); editNinja = null; });

document.getElementById('btn-filter-apply').addEventListener('click', handleFilterApply);
document.getElementById('btn-filter-cancel').addEventListener('click', function() { hide('modal-filter'); });

document.getElementById('btn-confirm-yes').addEventListener('click', handleConfirmDelete);
document.getElementById('btn-confirm-no').addEventListener('click', function() { hide('modal-confirm'); deleteTarget = null; });

document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// --- INIT ---
loadNinjas();
