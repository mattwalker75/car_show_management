// imageUpload.js - Profile photo upload with preview modal
// Handles: click Update Photo → pick file → preview in modal → Save or Cancel

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('updatePhotoBtn');
  var input = document.getElementById('profilePhotoInput');
  var modal = document.getElementById('photoPreviewModal');
  var preview = document.getElementById('photoPreviewImg');
  var saveBtn = document.getElementById('photoSaveBtn');
  var cancelBtn = document.getElementById('photoCancelBtn');

  if (!btn || !input) return;

  // Click "Update Photo" → open file picker
  btn.addEventListener('click', function() {
    input.click();
  });

  // File selected → show modal with preview
  input.addEventListener('change', function() {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      modal.style.display = 'flex';
    };
    reader.readAsDataURL(input.files[0]);
  });

  // Cancel → close modal, clear input
  cancelBtn.addEventListener('click', function() {
    modal.style.display = 'none';
    input.value = '';
  });

  // Close modal on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
      input.value = '';
    }
  });

  // Save → AJAX upload, update image in-place
  saveBtn.addEventListener('click', function() {
    if (!input.files || !input.files[0]) return;

    var formData = new FormData();
    formData.append('profile_photo', input.files[0]);

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    var role = document.body.dataset.userRole;

    fetch('/' + role + '/upload-photo', {
      method: 'POST',
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        // Update profile image on page
        var container = document.querySelector('.profile-image-container');
        container.innerHTML = '<img src="' + data.imageUrl + '" alt="Profile" class="profile-image">';
        // Update header avatar
        var avatar = document.querySelector('.user-avatar');
        if (avatar) {
          avatar.innerHTML = '<img src="' + data.imageUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        }
        modal.style.display = 'none';
        input.value = '';
      } else {
        alert(data.error || 'Upload failed. Please try again.');
      }
    })
    .catch(function() {
      alert('Upload failed. Please try again.');
    })
    .finally(function() {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    });
  });
});
