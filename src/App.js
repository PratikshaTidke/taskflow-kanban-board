import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import DatePicker from 'react-datepicker';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { isPast, format } from 'date-fns';
import { FiSun, FiMoon, FiCalendar } from 'react-icons/fi';
import { FaTasks, FaUserCircle } from 'react-icons/fa';
import "react-datepicker/dist/react-datepicker.css";
import './App.css';

// This is the special wrapper to fix react-beautiful-dnd in React 18+
function StrictModeWrapper({ children }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <>{children}</>;
}

const AnalyticsDashboard = ({ board }) => {
  const tasks = board.tasks || {};
  const totalTasks = Object.keys(tasks).length;
  const doneColumn = board.columns['column-3'] || { taskIds: [] };
  const completedTasks = doneColumn.taskIds.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const priorityData = useMemo(() => 
    [
      { name: 'High', value: Object.values(tasks).filter(t => t.priority === 'high').length },
      { name: 'Medium', value: Object.values(tasks).filter(t => t.priority === 'medium').length },
      { name: 'Low', value: Object.values(tasks).filter(t => t.priority === 'low').length },
    ].filter(p => p.value > 0),
    [tasks]
  );
  
  const COLORS = { high: '#e53935', medium: '#fdd835', low: '#43a047' };

  return (
    <div className="analytics-container">
      <div className="stat-box"><div className="stat-value">{totalTasks}</div><div className="stat-label">Total Tasks</div></div>
      <div className="stat-box"><div className="stat-value">{completedTasks}</div><div className="stat-label">Completed</div></div>
      <div className="stat-box"><div className="stat-value">{completionPercentage}%</div><div className="stat-label">Progress</div></div>
      <div className="chart-box">
        <div className="stat-label">Tasks by Priority</div>
        <ResponsiveContainer width="100%" height={100}>
          <PieChart>
            <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
              {priorityData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name.toLowerCase()]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function App() {
  const [board, setBoard] = useState({ tasks: {}, columns: {}, columnOrder: [] });
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const savedBoard = localStorage.getItem('kanbanBoard');
    if (savedBoard) {
      setBoard(JSON.parse(savedBoard));
    } else {
      setBoard({
        tasks: {},
        columns: {
          'column-1': { id: 'column-1', title: 'To Do', taskIds: [] },
          'column-2': { id: 'column-2', title: 'In Progress', taskIds: [] },
          'column-3': { id: 'column-3', title: 'Done', taskIds: [] },
        },
        columnOrder: ['column-1', 'column-2', 'column-3'],
      });
    }
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.body.className = savedTheme;
  }, []);

  useEffect(() => {
    if (board.columnOrder && board.columnOrder.length > 0) {
      localStorage.setItem('kanbanBoard', JSON.stringify(board));
    }
  }, [board]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
  };

  const handleAddTask = () => {
    if (!newTaskContent.trim() || !newTaskPriority) {
      alert("Please enter a task and select a priority.");
      return;
    }
    const newTaskId = uuidv4();
    const newTask = { id: newTaskId, content: newTaskContent, priority: newTaskPriority, dueDate: dueDate ? dueDate.toISOString() : null };
    const newBoard = { ...board, tasks: { ...board.tasks, [newTaskId]: newTask } };
    newBoard.columns['column-1'].taskIds.unshift(newTaskId);
    setBoard(newBoard);
    setNewTaskContent('');
    setNewTaskPriority('');
    setDueDate(null);
  };

  const handleDeleteTask = (taskId, columnId) => {
    const newBoard = { ...board };
    const column = newBoard.columns[columnId];
    const newTaskIds = column.taskIds.filter(id => id !== taskId);
    newBoard.columns[columnId].taskIds = newTaskIds;
    delete newBoard.tasks[taskId];
    setBoard(newBoard);
  };
  
  const handleStartEditing = (task) => {
    setEditingTaskId(task.id);
    setEditingText(task.content);
  };

  const handleSaveEdit = () => {
    if (!editingText.trim()) {
      const columnId = Object.keys(board.columns).find(id => board.columns[id].taskIds.includes(editingTaskId));
      if (columnId) { handleDeleteTask(editingTaskId, columnId); }
    } else {
      const newBoard = { ...board };
      newBoard.tasks[editingTaskId].content = editingText;
      setBoard(newBoard);
    }
    setEditingTaskId(null);
    setEditingText('');
  };
  
  const onDragEnd = (result) => {
    const { destination, source, draggableId, type } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }
    if (type === 'COLUMN') {
      const newColumnOrder = Array.from(board.columnOrder);
      newColumnOrder.splice(source.index, 1);
      newColumnOrder.splice(destination.index, 0, draggableId);
      setBoard({ ...board, columnOrder: newColumnOrder });
      return;
    }
    const startColumn = board.columns[source.droppableId];
    const finishColumn = board.columns[destination.droppableId];
    if (startColumn === finishColumn) {
      const newTaskIds = Array.from(startColumn.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      const newColumn = { ...startColumn, taskIds: newTaskIds };
      setBoard({ ...board, columns: { ...board.columns, [newColumn.id]: newColumn } });
      return;
    }
    const startTaskIds = Array.from(startColumn.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStartColumn = { ...startColumn, taskIds: startTaskIds };
    const finishTaskIds = Array.from(finishColumn.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinishColumn = { ...finishColumn, taskIds: finishTaskIds };
    setBoard({ ...board, columns: { ...board.columns, [newStartColumn.id]: newStartColumn, [newFinishColumn.id]: newFinishColumn } });
  };

  const filteredBoard = useMemo(() => {
    if (!searchTerm) { return board; }
    const newBoard = JSON.parse(JSON.stringify(board)); // Deep copy
    for (const columnId in newBoard.columns) {
      const column = newBoard.columns[columnId];
      column.taskIds = column.taskIds.filter(taskId =>
        board.tasks[taskId]?.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return newBoard;
  }, [searchTerm, board]);

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo"><FaTasks /><span>TaskFlow</span></div>
        <div className="navbar-actions">
          <button onClick={toggleTheme} className="theme-toggle">{theme === 'light' ? <FiMoon /> : <FiSun />}</button>
          <div className="profile-icon"><FaUserCircle /></div>
        </div>
      </nav>
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">TaskFlow</h1>
          <p className="app-tagline">Visualize your workflow, achieve your goals.</p>
        </header>
        <AnalyticsDashboard board={board} />
        <div className="search-container">
          <input type="text" placeholder="Search tasks..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="add-task-container">
          <input type="text" value={newTaskContent} onChange={(e) => setNewTaskContent(e.target.value)} placeholder="Add a new task..." className="task-input" />
          <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} className={`priority-select ${!newTaskPriority ? "default" : ""}`}>
            <option value="" disabled>Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="date-picker-wrapper">
            <FiCalendar className="calendar-icon" />
            <DatePicker selected={dueDate} onChange={(date) => setDueDate(date)} className="date-picker" placeholderText="Due Date" isClearable dateFormat="MMM d"   portalId="datepicker-portal"  />
          </div>
          <button onClick={handleAddTask} className="add-task-button">Add Task</button>
        </div>
        
        {/* We wrap the DragDropContext with our special wrapper */}
        <StrictModeWrapper>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
              {(provided) => (
                <div className="board-container" {...provided.droppableProps} ref={provided.innerRef}>
                  {(filteredBoard.columnOrder || []).map((columnId, index) => {
                    const column = filteredBoard.columns[columnId];
                    if (!column) return null; // Safety check
                    const tasks = (column.taskIds || []).map((taskId) => board.tasks[taskId]).filter(Boolean);
                    return (
                      <Draggable key={column.id} draggableId={column.id} index={index}>
                        {(provided) => (
                          <div className="column" {...provided.draggableProps} ref={provided.innerRef}>
                            <div className="column-header" {...provided.dragHandleProps}>
                              <h2 className="column-title">{column.title} ({tasks.length})</h2>
                            </div>
                            <Droppable droppableId={column.id} type="TASK">
                              {(provided, snapshot) => (
                                <div className={`task-list ${snapshot.isDraggingOver ? 'is-dragging-over' : ''}`} ref={provided.innerRef} {...provided.droppableProps}>
                                  {tasks.map((task, index) => {
                                    const isTaskOverdue = task.dueDate && isPast(new Date(task.dueDate));
                                    return (
                                      <Draggable key={task.id} draggableId={task.id} index={index}>
                                        {(provided) => (
                                          <div className={`task ${isTaskOverdue ? 'overdue' : ''}`} ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                            <div className="task-content" onDoubleClick={() => handleStartEditing(task)}>
                                              {task.priority && <span className={`priority-dot ${task.priority}`}></span>}
                                              <div className="task-main">
                                                {editingTaskId === task.id ? (
                                                  <input type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={handleSaveEdit} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} className="task-edit-input" autoFocus />
                                                ) : (
                                                  <span className="task-text">{task.content}</span>
                                                )}
                                                {task.dueDate && (<div className="due-date">Due: {format(new Date(task.dueDate), 'MMM d')}</div>)}
                                              </div>
                                            </div>
                                            <button onClick={() => handleDeleteTask(task.id, column.id)} className="delete-button">×</button>
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </StrictModeWrapper>
      </div>
    </>
  );
}

export default App;