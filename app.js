import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// --- FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAbBdc-sRQcz2olK98Y9P2GfVzD6HhoBdQ",
  authDomain: "narutogerenciador.firebaseapp.com",
  projectId: "narutogerenciador",
  storageBucket: "narutogerenciador.firebasestorage.app",
  messagingSenderId: "666018579115",
  appId: "1:666018579115:web:5c554f39d5400a1cf42dee",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONSTANTS ---
const COLLECTIONS = ['pontos_guilda', 'pontos_lua', 'pontos_sol', 'treino_sobrevivencia', 'pontos_mensal'];
const ELEMENTOS = ['Fogo', 'Água', 'Vento', 'Terra', 'Relâmpago', 'Outros', 'Nenhum', 'Ainda não adicionado'];
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
let filterFormState = { ...filters };

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
  d.appendChild(document.createTextNode(String(str ?? '')));
  return d.innerHTML;
}

function enrichNinja(n) {
  const fragAtual = n.fragmentos_atual ?? 0;
  const fragTotal = n.fragmentos_total ?? 0;
  const preco = n.preco ?? 0;
  const faltando = Math.max(0, fragTotal - fragAtual);
  return { ...n, fragmentosFaltando: faltando, custoTotal: faltando * preco };
}

// --- FILTER + SORT ---
function applyFilters() {
  let result = allNinjas.map(enrichNinja);

  if (filters.colecao && filters.colecao !== 'Todos') {
    result = result.filter(n => n.collection === filters.colecao);
  }
  if (filters.text.trim()) {
    const lower = filters.text.toLowerCase();
    result = result.filter(n => (n.ninja || '').toLowerCase().includes(lower));
  }
  if (filters.estrelas !== null) {
    result = result.filter(n => n.estrelas === filters.estrelas);
  }
  if (filters.elemento && filters.elemento !== 'Todos') {
    result = result.filter(n => n.elemento === filters.elemento);
  }
  if (filters.sortOrder === 'Mais Barato (Total)') {
    result.sort((a, b) => (a.custoTotal ?? 0) - (b.custoTotal ?? 0));
  } else if (filters.sortOrder === 'Mais Perto de Upar') {
    result.sort((a, b) => (a.fragmentosFaltando ?? 0) - (b.fragmentosFaltando ?? 0));
  }

  filteredNinjas = result;
}

// --- FIREBASE CRUD ---
async function loadNinjas() {
  setLoading(true);
  try {
    const all = [];
    for (const col of COLLECTIONS) {
      const snap = await getDocs(collection(db, col));
      snap.forEach(d => {
        const data = d.data();
        all.push({
          id: d.id,
          ...data,
          collection: col,
          estrelas: data.estrelas ?? null,
          elemento: data.elemento ?? 'Ainda não adicionado',
          fragmentos_total: data.fragmentos_total ?? 0,
          fragmentos_atual: data.fragmentos_atual ?? 0,
          preco: data.preco ?? 0,
        });
      });
    }
    allNinjas = all;
    applyFilters();
    renderCards();
  } catch (e) {
    console.error('Erro ao carregar ninjas:', e);
    alert('Erro ao carregar dados do Firebase.');
  } finally {
    setLoading(false);
  }
}

async function saveNew(data) {
  const { colecao, ...fields } = data;
  await addDoc(collection(db, colecao), fields);
  await loadNinjas();
}

async function saveEdit(oldCol, id, newCol, data) {
  if (newCol !== oldCol) {
    await addDoc(collection(db, newCol), data);
    await deleteDoc(doc(db, oldCol, id));
  } else {
    await updateDoc(doc(db, oldCol, id), data);
  }
  await loadNinjas();
}

async function deleteNinja(colecao, id) {
  await deleteDoc(doc(db, colecao, id));
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
    filteredNinjas.forEach(n => $grid.appendChild(createCard(n)));
  }
}

function createCard(ninja) {
  const preco = ninja.preco?.toString() ?? 'N/A';
  const fragAtual = ninja.fragmentos_atual?.toString() ?? 'N/A';
  const fragTotal = ninja.fragmentos_total?.toString() ?? 'N/A';
  const saldo = ninja.saldo != null ? ninja.saldo.toString() : 'N/A';
  const estrelas = ninja.estrelas ? '⭐'.repeat(Math.min(ninja.estrelas, 5)) : '—';
  const elemento = ninja.elemento ?? 'Nenhum';
  const origem = colName(ninja.collection);
  const faltando = ninja.fragmentosFaltando?.toString() ?? 'N/A';
  const custo = ninja.custoTotal != null ? Math.round(ninja.custoTotal).toString() : 'N/A';

  const card = document.createElement('div');
  card.className = 'ninja-card';
  card.innerHTML = `
    <div class="card-header">
      <span class="card-icon">✦</span>
      <span class="card-name">${escapeHtml(ninja.ninja)}</span>
      <span class="card-badge">Faltam: ${escapeHtml(faltando)}</span>
      <button class="btn-delete" type="button" title="Excluir">🗑️</button>
    </div>
    <div class="card-details">
      <div class="card-row">
        <span><span class="label">Preço:</span> ${escapeHtml(preco)}</span>
        <span><span class="label">Custo Total:</span> ${escapeHtml(custo)}</span>
        <span><span class="label">Estrelas:</span> ${estrelas}</span>
      </div>
      <div class="card-row">
        <span><span class="label">Frag. Atual:</span> ${escapeHtml(fragAtual)}</span>
        <span><span class="label">Frag. Total:</span> ${escapeHtml(fragTotal)}</span>
        <span><span class="label">Saldo:</span> ${escapeHtml(saldo)}</span>
      </div>
      <div class="card-row">
        <span><span class="label">Elemento:</span> ${escapeHtml(elemento)}</span>
        <span><span class="label">Origem:</span> ${escapeHtml(origem)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (!e.target.closest('.btn-delete')) openEditModal(ninja);
  });

  card.querySelector('.btn-delete').addEventListener('click', e => {
    e.stopPropagation();
    openConfirmDelete(ninja);
  });

  return card;
}

// --- OPTION BUTTONS RENDERER ---
function renderOptions(containerId, options, selected, onSelect, displayMap = {}) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn' + (selected === opt ? ' selected' : '');
    btn.textContent = displayMap[opt] ?? opt;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(opt);
    });
    container.appendChild(btn);
  });
}

// --- ADD MODAL ---
function openAddModal() {
  addFormState = { elemento: 'Nenhum', colecao: COLLECTIONS[0] };
  ['add-ninja', 'add-preco', 'add-frag-atual', 'add-frag-total', 'add-saldo', 'add-estrelas']
    .forEach(id => document.getElementById(id).value = '');
  renderOptions('add-elemento-options', ELEMENTOS, addFormState.elemento, v => { addFormState.elemento = v; });
  renderOptions('add-colecao-options', COLLECTIONS, addFormState.colecao, v => { addFormState.colecao = v; }, COL_NAMES);
  show('modal-add');
}

async function handleAddSave() {
  const ninja = document.getElementById('add-ninja').value.trim();
  const preco = document.getElementById('add-preco').value;
  const fragAtual = document.getElementById('add-frag-atual').value;
  const fragTotal = document.getElementById('add-frag-total').value;
  const saldo = document.getElementById('add-saldo').value;
  const estrelas = document.getElementById('add-estrelas').value;

  if (!ninja || !preco || !fragAtual || !fragTotal) {
    alert('Preencha o Nome, Preço e Fragmentos (Atual e Total).');
    return;
  }

  try {
    await saveNew({
      ninja,
      preco: parseInt(preco) || 0,
      fragmentos_atual: parseInt(fragAtual) || 0,
      fragmentos_total: parseInt(fragTotal) || 0,
      saldo: saldo ? parseInt(saldo) : null,
      estrelas: estrelas ? parseInt(estrelas) : null,
      elemento: addFormState.elemento,
      colecao: addFormState.colecao,
    });
    hide('modal-add');
  } catch (e) {
    console.error(e);
    alert('Erro ao adicionar ninja.');
  }
}

// --- EDIT MODAL ---
function openEditModal(ninja) {
  editNinja = ninja;
  editFormState.elemento = ninja.elemento ?? 'Ainda não adicionado';
  editFormState.colecao = ninja.collection ?? COLLECTIONS[0];

  document.getElementById('edit-modal-title').textContent = `Editar ${ninja.ninja ?? ''}`;
  document.getElementById('edit-ninja').value = ninja.ninja ?? '';
  document.getElementById('edit-preco').value = ninja.preco?.toString() ?? '';
  document.getElementById('edit-frag-atual').value = ninja.fragmentos_atual?.toString() ?? '';
  document.getElementById('edit-frag-total').value = ninja.fragmentos_total?.toString() ?? '';
  document.getElementById('edit-saldo').value = ninja.saldo?.toString() ?? '';
  document.getElementById('edit-estrelas').value = ninja.estrelas?.toString() ?? '';

  renderOptions('edit-elemento-options', ELEMENTOS, editFormState.elemento, v => { editFormState.elemento = v; });
  renderOptions('edit-colecao-options', COLLECTIONS, editFormState.colecao, v => { editFormState.colecao = v; }, COL_NAMES);
  show('modal-edit');
}

async function handleEditSave() {
  if (!editNinja) return;

  const ninjaName = document.getElementById('edit-ninja').value.trim();
  const preco = document.getElementById('edit-preco').value;
  const fragAtual = document.getElementById('edit-frag-atual').value;
  const fragTotal = document.getElementById('edit-frag-total').value;
  const saldo = document.getElementById('edit-saldo').value;
  const estrelas = document.getElementById('edit-estrelas').value;

  try {
    await saveEdit(editNinja.collection, editNinja.id, editFormState.colecao, {
      ninja: ninjaName,
      preco: parseInt(preco) || null,
      fragmentos_atual: parseInt(fragAtual) || 0,
      fragmentos_total: parseInt(fragTotal) || 0,
      saldo: saldo ? parseInt(saldo) : null,
      estrelas: estrelas ? parseInt(estrelas) : null,
      elemento: editFormState.elemento,
    });
    hide('modal-edit');
    editNinja = null;
  } catch (e) {
    console.error(e);
    alert('Erro ao salvar ninja.');
  }
}

// --- FILTER MODAL ---
function openFilterModal() {
  filterFormState = { ...filters };
  document.getElementById('filter-text').value = filterFormState.text;
  document.getElementById('filter-estrelas').value = filterFormState.estrelas?.toString() ?? '';

  const filterElementos = ['Todos', ...ELEMENTOS];
  const filterColecoes = ['Todos', ...COLLECTIONS];

  renderOptions('filter-elemento-options', filterElementos, filterFormState.elemento ?? 'Todos', v => { filterFormState.elemento = v; });
  renderOptions('filter-colecao-options', filterColecoes, filterFormState.colecao ?? 'Todos', v => { filterFormState.colecao = v; }, COL_NAMES);
  renderOptions('filter-sort-options', SORT_OPTIONS, filterFormState.sortOrder, v => { filterFormState.sortOrder = v; });
  show('modal-filter');
}

function handleFilterApply() {
  filters.text = document.getElementById('filter-text').value;
  const estrelasVal = document.getElementById('filter-estrelas').value;
  filters.estrelas = estrelasVal ? parseInt(estrelasVal) : null;
  filters.elemento = filterFormState.elemento ?? 'Todos';
  filters.colecao = filterFormState.colecao ?? 'Todos';
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
    `Excluir "${ninja.ninja}" da coleção "${colName(ninja.collection)}"? Esta ação é irreversível.`;
  show('modal-confirm');
}

async function handleConfirmDelete() {
  if (!deleteTarget) return;
  const { id, collection: col } = deleteTarget;
  hide('modal-confirm');
  deleteTarget = null;
  try {
    await deleteNinja(col, id);
  } catch (e) {
    console.error(e);
    alert('Erro ao excluir ninja.');
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
document.getElementById('btn-add-cancel').addEventListener('click', () => hide('modal-add'));

document.getElementById('btn-edit-save').addEventListener('click', handleEditSave);
document.getElementById('btn-edit-cancel').addEventListener('click', () => { hide('modal-edit'); editNinja = null; });

document.getElementById('btn-filter-apply').addEventListener('click', handleFilterApply);
document.getElementById('btn-filter-cancel').addEventListener('click', () => hide('modal-filter'));

document.getElementById('btn-confirm-yes').addEventListener('click', handleConfirmDelete);
document.getElementById('btn-confirm-no').addEventListener('click', () => { hide('modal-confirm'); deleteTarget = null; });

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// --- INIT ---
loadNinjas();
