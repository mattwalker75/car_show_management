// imageModal.js - Fullscreen image modal viewer
// Opens a modal overlay showing a full-size image when a thumbnail is clicked.
// Used on vehicle detail and vehicle list pages.

function openImageModal(src, alt) {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('modalImage');
  img.src = src;
  img.alt = alt;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  const modal = document.getElementById('imageModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeImageModal();
  }
});
