document.addEventListener("DOMContentLoaded", async () => {
  const mailList = document.getElementById("mail-list");

  try {
    const response = await fetch("http://127.0.0.1:8000/mail/all");
    const mails = await response.json();
    console.log("Mails reçus :", mails);

    if (mails.length === 0) {
      mailList.innerHTML = "<p>Aucun mail envoyé.</p>";
      return;
    }

    mails.forEach(mail => {
      const item = document.createElement("div");
      item.classList.add("mail-item");
      item.innerHTML = `
        <p><strong>From:</strong> ${mail.sender}</p>
        <p><strong>To:</strong> ${mail.recipient}</p>
        <p><strong>Subject:</strong> ${mail.subject}</p>
        <p>${mail.body}</p>
        <p><em>Sent at: ${new Date(mail.sent_at).toLocaleString()}</em></p>
      `;
      mailList.appendChild(item);
    });
  } catch (error) {
    mailList.innerHTML = `<p>Erreur de chargement des mails : ${error.message}</p>`;
  }
});

document.getElementById("btn-back").addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
