// imageUpload.js - Client-side file input preview
// Shows the selected filename and displays an image preview when a file is chosen.
// Used on profile photo and vehicle photo upload forms.

function updateFileName(input) {
  const fileName = document.getElementById('fileName');
  const wrapper = document.getElementById('fileWrapper');
  const preview = document.getElementById('imagePreview');
  if (input.files && input.files[0]) {
    fileName.textContent = 'Selected: ' + input.files[0].name;
    wrapper.classList.add('has-file');
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      preview.style.marginLeft = 'auto';
      preview.style.marginRight = 'auto';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    fileName.textContent = '';
    wrapper.classList.remove('has-file');
    preview.style.display = 'none';
    preview.src = '';
  }
}
