# Workflow
* Use Slash command in Slack, provide the link to the card that has been sent through
* This will call the Shortcut API, and retrieve card details
    * Card title, customer's email and ID, importance etc.
* Formats the card details into readable slack message.
    * e.g. Feature | 31937 | Jupiter | someone@example.com |  Add support to show icons on tabs with active shipments in them {link-to-card}
* Post message in #feature-requests channel
