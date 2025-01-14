//////////////////////////////////////////////////////////////////////////////80
// FileManager Init
//////////////////////////////////////////////////////////////////////////////80
// Copyright (c) Atheos & Liam Siira (Atheos.io), distributed as-is and without
// warranty under the MIT License. See [root]/docs/LICENSE.md for more.
// This information must remain intact.
//////////////////////////////////////////////////////////////////////////////80
// Authors: Codiad Team, @Fluidbyte, Atheos Team, @hlsiira
//////////////////////////////////////////////////////////////////////////////80
// Notes: 
// Goodness this file is very complex; it's going to take a very long time
// to really get a grasp of what's going on in this file and how to 
// refactor it.
//												- Liam Siira
//////////////////////////////////////////////////////////////////////////////80

(function() {
	'use strict';

	function formatBytes(bytes, decimals = 1) {
		// Source: https://stackoverflow.com/a/18650828
		if (bytes === 0) {
			return '0B';
		}

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
	}

	const self = {
		uploadPath: false,

		//////////////////////////////////////////////////////////////////////80
		// Initilization
		//////////////////////////////////////////////////////////////////////80
		init: function() {
			fX('#dialog .transfer').on('change', self.upload);
			fX('#upload_wrapper').on('drop', self.upload);
			fX('#upload_wrapper').on('dragover, mouseover', self.dragover);
			fX('#upload_wrapper').on('dragleave, mouseout', self.dragleave);
		},

		//////////////////////////////////////////////////////////////////////80
		// Open upload dialog
		//////////////////////////////////////////////////////////////////////80
		openUpload: function(anchor) {
			// Source: https://codepen.io/PerfectIsShit/pen/zogMXP?editors=1010
			// Source: http://significanttechno.com/file-upload-progress-bar-using-javascript

			self.uploadPath = anchor.path;

			atheos.modal.load(400, {
				target: 'transfer',
				action: 'upload',
				path: self.uploadPath
			});
		},

		//////////////////////////////////////////////////////////////////////80
		// Download
		//////////////////////////////////////////////////////////////////////80
		download: function(anchor) {
			let path = anchor.path,
				type = pathinfo(path).type;
			echo({
				url: atheos.controller,
				data: {
					target: 'transfer',
					action: 'download',
					path,
					type
				},
				settled: function(reply, status) {
					if (status === 200) {
						oX('#download').attr('src', 'components/transfer/download.php?path=' + encodeURIComponent(reply.download));
					} else {
						atheos.toast.show('error', reply.text);
					}
				}
			});
		},

		//////////////////////////////////////////////////////////////////////80
		// Drag over
		//////////////////////////////////////////////////////////////////////80
		dragover: function(e) {
			event.preventDefault();
			oX('#upload_wrapper').addClass('hover');
		},

		//////////////////////////////////////////////////////////////////////80
		// Drag leave
		//////////////////////////////////////////////////////////////////////80
		dragleave: function(e) {
			oX('#upload_wrapper').removeClass('hover');
		},

		//////////////////////////////////////////////////////////////////////80
		// Upload data
		//////////////////////////////////////////////////////////////////////80
		upload: function(e) {
			e.preventDefault();
			e.stopPropagation();

			var input = oX('#dialog input[type="file"]').element,
				files = [];

			if (e.dataTransfer) {
				// Handle drag-and-drop files
				if (e.dataTransfer.items) {
					[...e.dataTransfer.items].forEach((item) => {
						if (item.kind === 'file') {
							files.push(item.getAsFile());
						}
					});
				} else {
					files = [...e.dataTransfer.files];
				}
			} else if (e.target && e.target.files) {
				// Handle file input files
				files = [...e.target.files];
			}

			let fileCount = files.length;
			if (fileCount <= 0) return;

			for (var x = 0; x < fileCount; x++) {
				self.uploadFile(files[x]);
			}
			input.value = '';
		},

		//////////////////////////////////////////////////////////////////////80
		// Upload file
		//////////////////////////////////////////////////////////////////////80
		uploadFile: function(file) {

			let progress = self.showProgress(file.name),
				data = new FormData();

			data.append('upload[]', file);
			data.append('target', 'transfer');
			data.append('action', 'upload');
			data.append('path', self.uploadPath);

			var send = new XMLHttpRequest();
			send.upload.addEventListener('progress', progress, false);
			send.addEventListener('error', progress, false);
			send.open('POST', atheos.controller);

			send.onreadystatechange = function() {
				if (send.readyState === 4) {

					if (send.status >= 200 && send.status < 300) {
						var reply = send.responseText;
						try {
							reply = JSON.parse(reply);
							self.processUpload(reply);
						} catch (e) {
						    output('error', e);
						}
					} else {
						progress({
							type: 'error'
						});
					}
				}
			};
			send.send(data);

		},

		//////////////////////////////////////////////////////////////////////80
		// Process Upload
		//////////////////////////////////////////////////////////////////////80
		processUpload: function(reply) {
			if (reply.status !== 200) {
				return toast(reply);
			}

			atheos.filemanager.addToFileManager(reply.filepath, 'file', reply.parent);
			carbon.publish('filemanager.upload', {
				name: reply.filename,
				path: reply.filepath,
				parent: reply.parent
			});
		},

		//////////////////////////////////////////////////////////////////////80
		// Show Progress
		//////////////////////////////////////////////////////////////////////80
		showProgress: function(name) {
			// Loading event doesn't send the total, so grab it from the progress
			// event and save it for later.
			var total;
			let node = oX('<div class="upload-progress"><div></div><span></span></div>');
			oX('#progress_wrapper').append(node);

			return function(event) {
				if (event.type === 'progress') {
					total = formatBytes(event.total);
					var percent = parseInt((event.loaded / event.total) * 100, 10);
					node.find('span').text(`${name}: ${percent}% (${formatBytes(event.loaded)}/${total})`);
					node.find('div').css('width', Math.round(percent) + '%');
					// _("status").innerHTML = Math.round(percent) + "% uploaded... please wait";

					if (percent === 100) {
						setTimeout(function() {
							atheos.flow.slide('remove', node.element, 500);
						}, 3000);
					}

				} else {
					node.find('span').text(`${name}: Upload failed...`);
					node.find('div').css('width', '100%');
					node.find('div').addClass('error');
				}
			};
		}
	};

	carbon.subscribe('system.loadMinor', () => self.init());
	atheos.transfer = self;

})();
