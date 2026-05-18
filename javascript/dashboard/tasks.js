function setTaskFilter(filterType, element) {
    document.querySelectorAll('.task-filter-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    currentTaskFilter = filterType.toLowerCase().trim();
    renderTodos();
}

async function fetchTodos() {
    if (typeof sb === 'undefined') return;
    
    const { data, error } = await sb.from('todos')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
        
    if (error) return console.error(error);
  
    allTodos = data.filter(t => {
        const isDone = (t.is_done === true || t.is_done === 'true');
        if (isDone) {
            const doneMatch = t.task.match(/!done_(\S+)/);
            if (doneMatch) {
                const doneDate = new Date(doneMatch[1]);
                const diffHours = (new Date() - doneDate) / (1000 * 60 * 60);
                if (diffHours > 48) {
                    sb.from('todos').delete().eq('id', t.id).then(); 
                    return false;
                }
            }
        }
        return true;
    });
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    const now = new Date();
    now.setHours(0,0,0,0);
  
    let filter = currentTaskFilter;
    if (filter === 'done') filter = 'completed'; 

    let filtered = allTodos.filter(t => {
        const isDone = (t.is_done === true || t.is_done === 'true');
        let dateMatch = t.task.match(/@(\d{4}-\d{2}-\d{2})/);
        let taskDate = null;
      
        if (dateMatch) {
            let [y, m, d] = dateMatch[1].split('-');
            taskDate = new Date(y, m - 1, d);
            taskDate.setHours(0,0,0,0);
        }

        let isTodayOrOverdue = false;
        let isUpcoming = true;

        if (taskDate) {
            let diffTime = taskDate.getTime() - now.getTime();
            let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays <= 0) { 
                isTodayOrOverdue = true; 
                isUpcoming = false; 
            } else {
                isTodayOrOverdue = false;
                isUpcoming = true;
            }
        }

        if (filter === 'all') return true; 
        if (filter === 'today') return !isDone && isTodayOrOverdue;
        if (filter === 'upcoming') return !isDone && isUpcoming;
        if (filter === 'completed') return isDone;
        return false; 
    });

    list.innerHTML = filtered.map(t => {
        const isDone = (t.is_done === true || t.is_done === 'true');
        let taskText = t.task.replace(/!done_\S+/, ''); 
        let tagMatch = taskText.match(/#(\w+)/);
        let dateMatch = taskText.match(/@(\d{4}-\d{2}-\d{2})/);
      
        let tag = tagMatch ? tagMatch[1] : null;
        let absoluteDate = dateMatch ? dateMatch[1] : null;
        let cleanTask = taskText.replace(/#\w+/g, '').replace(/@[\w-]+/g, '').trim();

        let tagHtml = tag ? `<span class="tag-chip">${tag}</span>` : '';
        let dateHtml = '';

        if (absoluteDate) {
            let [y, m, d] = absoluteDate.split('-');
            let tDate = new Date(y, m - 1, d);
            tDate.setHours(0,0,0,0);
            let diffDays = Math.round((tDate - now) / (1000 * 60 * 60 * 24));
            let label = "";
            let colorStyle = "";
          
            if (diffDays === 0) { label = "Today"; }
            else if (diffDays === 1) { label = "Tomorrow"; }
            else if (diffDays < 0) { 
                label = "Overdue"; 
                colorStyle = "color: var(--tc-life); border-color: var(--tc-life); background: rgba(232,125,125,0.1);"; 
            }
            else { label = tDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}); }
            dateHtml = `<span class="date-chip" style="${colorStyle}">${label}</span>`;
        }

        return `
        <li class="list-item" draggable="true" data-id="${t.id}">
            <div class="drag-handle" title="Drag to reorder">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            <input type="checkbox" class="custom-checkbox" ${isDone ? 'checked' : ''} onchange="toggleTodo(${t.id}, this.checked)">
            <span class="item-title" style="${isDone ? 'text-decoration:line-through; opacity:0.5' : ''}; cursor: pointer;" onclick="editTodo(${t.id})" title="Click to edit">${cleanTask}</span>
            ${tagHtml}
            <div class="item-meta right">
                ${dateHtml}
                <button onclick="deleteTodo(${t.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:16px; margin-left:12px; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✕</button>
            </div>
        </li>
        `;
    }).join('');
  
    const countEl = document.getElementById('todo-count');
    const doneCount = allTodos.filter(t => (t.is_done === true || t.is_done === 'true')).length;
    if (countEl) countEl.innerText = `Completed ${doneCount} tasks`;

    if (typeof renderCalendar === 'function') renderCalendar();
}

async function editTodo(id) {
    let taskObj = allTodos.find(x => x.id === id);
    if (!taskObj) return;

    let rawTask = taskObj.task.replace(/ !done_\S+/, '');
    let updatedTask = await customPrompt("edit_task", rawTask);
    
    if (updatedTask === null || updatedTask.trim() === "") return;
    let finalTask = convertRelativeDateTag(updatedTask.trim());

    if (taskObj.is_done) {
        let doneMatch = taskObj.task.match(/!done_\S+/);
        if (doneMatch) finalTask += ` ${doneMatch[0]}`;
    }

    taskObj.task = finalTask;
    renderTodos(); 
    await sb.from('todos').update({ task: finalTask }).eq('id', id); 
    fetchTodos(); 
}

async function toggleTodo(id, is_done) { 
    let taskObj = allTodos.find(x => x.id === id);
    if (!taskObj) return;
    
    let newTaskText = taskObj.task.replace(/ !done_\S+/, ''); 
    if (is_done) {
        let isoNow = new Date().toISOString();
        newTaskText += ` !done_${isoNow}`;
    }
    
    taskObj.is_done = is_done;
    taskObj.task = newTaskText;
    renderTodos(); 
    await sb.from('todos').update({ is_done: is_done, task: newTaskText }).eq('id', id); 
    fetchTodos(); 
}

async function deleteTodo(id) { await sb.from('todos').delete().eq('id', id); fetchTodos(); }

function convertRelativeDateTag(taskStr) {
    let tagMatch = taskStr.match(/@(\w+)/);
    if (!tagMatch) return taskStr;

    let keyword = tagMatch[1].toLowerCase();
    let targetDate = new Date();

    if (['today', 'tod'].includes(keyword)) {
        targetDate = new Date(); 
    } else if (['tomorrow', 'tmrw', 'tom'].includes(keyword)) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else {
        const days = ['sun','mon','tue','wed','thu','fri','sat'];
        const dayIndex = days.findIndex(d => keyword.startsWith(d));
        if (dayIndex !== -1) {
            let currentDay = targetDate.getDay();
            let diff = dayIndex - currentDay;
            if (diff <= 0) diff += 7; 
            targetDate.setDate(targetDate.getDate() + diff);
        } else if (keyword.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return taskStr; 
        } else {
            return taskStr; 
        }
    }
    
    let y = targetDate.getFullYear();
    let m = String(targetDate.getMonth() + 1).padStart(2, '0');
    let d = String(targetDate.getDate()).padStart(2, '0');
    let localDateStr = `${y}-${m}-${d}`;
    
    return taskStr.replace(`@${tagMatch[1]}`, `@${localDateStr}`);
}

function initDragAndDrop() {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;

    todoList.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.list-item');
        if (!item) return;
        setTimeout(() => item.classList.add('dragging'), 0);
    });

    todoList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(todoList, e.clientY);
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;
        
        if (afterElement == null) {
            todoList.appendChild(draggingItem);
        } else {
            todoList.insertBefore(draggingItem, afterElement);
        }
    });

    todoList.addEventListener('dragend', (e) => {
        const item = e.target.closest('.list-item');
        if (item) item.classList.remove('dragging');
        saveTaskOrder();
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.list-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveTaskOrder() {
    const items = document.querySelectorAll('#todo-list .list-item');
    items.forEach((item, index) => {
        const id = parseInt(item.getAttribute('data-id'));
        const taskObj = allTodos.find(t => t.id === id);
        if (taskObj) taskObj.order_index = index;
        sb.from('todos').update({ order_index: index }).eq('id', id).then();
    });
    allTodos.sort((a, b) => {
        const orderA = a.order_index ?? 0;
        const orderB = b.order_index ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at) - new Date(a.created_at);
    });
}