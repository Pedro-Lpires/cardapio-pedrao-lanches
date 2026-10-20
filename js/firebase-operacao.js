/**
 * Inicialização do Firebase nas páginas operacionais independentes. Reutiliza a instância quando ela já existe.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
// Configuração pública; a autorização de acesso deve ser aplicada nas regras do Firestore.
firebase.initializeApp({
  apiKey: "AIzaSyD2ZQbBk5zTlkwh91cQ3HF-ZBpXzFE3IQk",
  authDomain: "pedrao-lanches.firebaseapp.com",
  projectId: "pedrao-lanches",
  storageBucket: "pedrao-lanches.firebasestorage.app",
  messagingSenderId: "642954187872",
  appId: "1:642954187872:web:38efbecf53357e57b0df05",
});
const db = firebase.firestore();
