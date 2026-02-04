// imageModal.js - Fullscreen image modal viewer
// Opens a modal overlay showing a full-size image when a thumbnail is clicked.
// Used on vehicle detail and vehicle list pages.

function openImageModal(src, alt) {
  var modal = document.getElementById('imageModal');
  var img = document.getElementById('modalImage');
  if (!modal || !img) return;
  img.src = src;
  img.alt = alt || '';
  img.onerror = function() { img.alt = 'Image failed to load'; };
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  var modal = document.getElementById('imageModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal with Escape key (only if modal is open)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modal = document.getElementById('imageModal');
    if (modal && modal.classList.contains('active')) {
      closeImageModal();
    }
  }
});

// Close modal when clicking the overlay background
document.addEventListener('click', function(e) {
  var modal = document.getElementById('imageModal');
  if (modal && e.target === modal) {
    closeImageModal();
  }
});
