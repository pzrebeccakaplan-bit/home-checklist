export function ChecklistItem({ item, completion, onToggle, readOnly }) {
  const isChecked = !!completion
  const checkedBy = completion?.profiles?.display_name

  return (
    <button
      className={`checklist-item ${isChecked ? 'checked' : ''} ${readOnly ? 'read-only' : ''}`}
      onClick={() => !readOnly && onToggle(item)}
      disabled={readOnly}
      aria-pressed={isChecked}
    >
      <span className="check-box">{isChecked ? '✓' : ''}</span>
      <span className="item-text">{item.text}</span>
      {isChecked && checkedBy && (
        <span className="checked-by">{checkedBy}</span>
      )}
    </button>
  )
}
