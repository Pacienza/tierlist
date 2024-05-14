
const MAX_NAME_LEN = 200;
const DEFAULT_TIERS = ['S','A','B','C','D','E','F'];
const TIER_COLORS = [
	'#ff6666',
	'#f0a731',
	'#f4d95b',
	'#66ff66',
	'#58c8f4',
	'#5b76f4',
	'#f45bed'
];

let unique_id = 0;
let unsaved_changes = false;
let all_headers = [];
let headers_orig_min_width;
let untiered_images;
let tierlist_div;
let dragged_image;


window.addEventListener('load', () => {
	untiered_images =  document.querySelector('.images');
	tierlist_div =  document.querySelector('.tierlist');

	for (let i = 0; i < DEFAULT_TIERS.length; ++i) {
		add_row(i, DEFAULT_TIERS[i]);
	}
	recompute_header_colors();

	headers_orig_min_width = all_headers[0][0].clientWidth;

	make_accept_drop(document.querySelector('.images'));


	document.getElementById('load-img-input').addEventListener('input', (evt) => {
		let images = document.querySelector('.images');
		for (let file of evt.target.files) {
			let reader = new FileReader();
			reader.addEventListener('load', (load_evt) => {
				let img = create_img_with_src(load_evt.target.result);
				images.appendChild(img);
				unsaved_changes = true;
			});
			reader.readAsDataURL(file);
		}
	});

	document.onpaste = (evt) => {
		let clip_data = evt.clipboardData || evt.originalEvent.clipboardData;
		let items = clip_data.items;
		let images = document.querySelector('.images');
		for (let item of items) {
			if (item.kind === 'file') {
				let blob = item.getAsFile();
				let reader = new FileReader();
				reader.onload = (load_evt) => {
					let img = create_img_with_src(load_evt.target.result);
					images.appendChild(img);
					unsaved_changes = true;
				};
				reader.readAsDataURL(blob);
			}
		}
	};

	document.getElementById('import-input').addEventListener('input', (evt) => {
		if (!evt.target.files) {
			return;
		}
		let file = evt.target.files[0];
		let reader = new FileReader();
		reader.addEventListener('load', (load_evt) => {
			let raw = load_evt.target.result;
			let parsed = JSON.parse(raw);
			if (!parsed) {
				alert("Failed to parse data");
				return;
			}
			hard_reset_list();
			load_tierlist(parsed);
		});
		reader.readAsText(file);
	});

	bind_trash_events();

	window.addEventListener('beforeunload', (evt) => {
		if (!unsaved_changes) return null;
		var msg = "You have unsaved changes. Leave anyway?";
		(evt || window.event).returnValue = msg;
		return msg;
	});
});

function create_img_with_src(src) {
	let img = document.createElement('img');
	img.src = src;
	img.style.userSelect = 'none';
	img.classList.add('draggable');
	img.draggable = true;
	img.ondragstart = "event.dataTransfer.setData('text/plain', null)";
	img.addEventListener('mousedown', (evt) => {
		dragged_image = evt.target;
		dragged_image.classList.add("dragged");
	});
	return img;
}

function save(filename, text) {
	unsaved_changes = false;

	var el = document.createElement('a');
	el.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(text));
	el.setAttribute('download', filename);
	el.style.display = 'none';
	document.body.appendChild(el);
	el.click();
	document.body.removeChild(el);
}


function end_drag(evt) {
	dragged_image?.classList.remove("dragged");
	dragged_image = null;
}

window.addEventListener('mouseup', end_drag);
window.addEventListener('dragend', end_drag);

function make_accept_drop(elem) {
	elem.classList.add('droppable');

	elem.addEventListener('dragenter', (evt) => {
		evt.target.classList.add('drag-entered');
	});
	elem.addEventListener('dragleave', (evt) => {
		evt.target.classList.remove('drag-entered');
	});
	elem.addEventListener('dragover', (evt) => {
		evt.preventDefault();
	});
	elem.addEventListener('drop', (evt) => {
		evt.preventDefault();
		evt.target.classList.remove('drag-entered');

		if (!dragged_image) {
			return;
		}

		let dragged_image_parent = dragged_image.parentNode;
		if (dragged_image_parent.tagName.toUpperCase() === 'SPAN' &&
				dragged_image_parent.classList.contains('item')) {
			let containing_tr = dragged_image_parent.parentNode;
			containing_tr.removeChild(dragged_image_parent);
		} else {
			dragged_image_parent.removeChild(dragged_image);
		}
		let td = document.createElement('span');
		td.classList.add('item');
		td.appendChild(dragged_image);
		let items_container = elem.querySelector('.items');
		if (!items_container) {
			items_container = elem;
		}
		items_container.appendChild(td);

		unsaved_changes = true;
	});
}

function enable_edit_on_click(container, input, label) {
	function change_label(evt) {
		input.style.display = 'none';
		label.innerText = input.value;
		label.style.display = 'inline';
		unsaved_changes = true;
	}

	input.addEventListener('change', change_label);
	input.addEventListener('focusout', change_label);

	container.addEventListener('click', (evt) => {
		label.style.display = 'none';
		input.value = label.innerText.substr(0, MAX_NAME_LEN);
		input.style.display = 'inline';
		input.select();
	});
}

function bind_title_events() {
	let title_label = document.querySelector('.title-label');
	let title_input = document.getElementById('title-input');
	let title = document.querySelector('.title');

	enable_edit_on_click(title, title_input, title_label);
}

function create_label_input(row, row_idx, row_name) {
	let input = document.createElement('input');
	input.id = `input-tier-${unique_id++}`;
	input.type = 'text';
	input.addEventListener('change', resize_headers);
	let label = document.createElement('label');
	label.htmlFor = input.id;
	label.innerText = row_name;

	let header = row.querySelector('.header');
	all_headers.splice(row_idx, 0, [header, input, label]);
	header.appendChild(label);
	header.appendChild(input);

}

function resize_headers() {
	let max_width = headers_orig_min_width;
	for (let [other_header, _i, label] of all_headers) {
		max_width = Math.max(max_width, label.clientWidth);
	}

	for (let [other_header, _i2, _l2] of all_headers) {
		other_header.style.minWidth = `${max_width}px`;
	}
}

function add_row(index, name) {
	let div = document.createElement('div');
	let header = document.createElement('span');
	let items = document.createElement('span');
	div.classList.add('row');
	header.classList.add('header');
	items.classList.add('items');
	div.appendChild(header);
	div.appendChild(items);
	

	let rows = tierlist_div.children;
	if (index === rows.length) {
		tierlist_div.appendChild(div);
	} else {
		let nxt_child = rows[index];
		tierlist_div.insertBefore(div, nxt_child);
	}

	make_accept_drop(div);
	create_label_input(div, index, name);

	return div;
}

function recompute_header_colors() {
	tierlist_div.querySelectorAll('.row').forEach((row, row_idx) => {
		let color = TIER_COLORS[row_idx % TIER_COLORS.length];
		row.querySelector('.header').style.backgroundColor = color;
	});
}

