function showBootError(copy) {
  const root = document.getElementById('boot-status');
  if (!root) return;

  const card = document.createElement('div');
  card.className = 'boot-card';

  const title = document.createElement('h1');
  title.className = 'boot-title';
  title.textContent = 'Erreur de démarrage';

  const description = document.createElement('p');
  description.className = 'boot-copy';
  description.textContent = copy;

  card.append(title, description);
  root.replaceChildren(card);
}

window.addEventListener('error', (event) => {
  void event;
  console.error('Flashover78 boot error');
  showBootError(
    'Le navigateur a chargé la page, mais le JavaScript a planté avant l’affichage.'
  );
});

window.addEventListener('unhandledrejection', (event) => {
  void event;
  console.error('Flashover78 boot rejection');
  showBootError(
    'Une promesse a été rejetée pendant l’initialisation de l’application.'
  );
});
