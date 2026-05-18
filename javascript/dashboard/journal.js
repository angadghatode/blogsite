/* ================================================================
   ANGAD.LOG — journal.js
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const journalBtn = document.getElementById('journalSubmitBtn');
    const journalInput = document.getElementById('journalInput');

    if (journalBtn && journalInput) {
        journalBtn.addEventListener('click', async () => {
            const content = journalInput.value.trim();
            if (!content) return;

            journalBtn.innerText = "SAVING...";
            journalBtn.disabled = true;

            try {
                // Creates a note tagged with the current date
                const dateTitle = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                const { error } = await sb.from('notes').insert([{ 
                    title: `Journal: ${dateTitle}`, 
                    content: `<div>${content}</div>`, 
                    is_folder: false, 
                    parent_id: null 
                }]);
                
                if (error) throw error;
                
                if (typeof toast !== 'undefined') toast('Journal entry saved to Notes.');
                journalInput.value = ''; // Clear the box
                if (typeof fetchNotes === 'function') fetchNotes(); // Refresh notes list
            } catch (err) {
                if (typeof toast !== 'undefined') toast('Error saving journal.', true);
                console.error(err);
            } finally {
                journalBtn.innerText = "SAVE ENTRY";
                journalBtn.disabled = false;
            }
        });
    }
});