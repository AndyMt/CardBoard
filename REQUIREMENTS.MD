# CardBoard requierements

CardBoard shall be a collaborative web application that allows users to place cards and groups on a board. Users shall be able to drag and drop cards between different groups. The application shall also allow users to add new groups and cards.

## Architecture and Design guidelines

- use TypeScript for code.
- Persistence shall use JSON files.
- Use a lockfile to prevent multiple edits on the same file simultaneously.
- Use a model-view-controller (MVC) architecture.
- make sure persistence is separated from the application logic.
- Server shall run on port 8080 by default.

# Requirements

The application shall have the following features:

## User interface

- toolbar with buttons for adding groups, cards and selecting/deselecting/moving items on the top border
- toolbar buttons shall be order left to right.
- the toolbar shall not scroll with the canvas = shall always stay visible.
- when a toolbar button is selected, its background color shall be highlighted.
- for card or group when clicking into some empty area shall place the element at that position and go right into edit mode.
- indicator how many users are currently on the board is shown in the toolbar in the top right corner.

## Card element

- default size is 200 pixels or approx 30 characters wide.
- Border shall be 2px thick continuous
- Text shall be centered horizontally
- Text shall be rendered with word break
- Height shall adapt according to number of lines needed
- clicking on the card border shall select the card.

## Group element

- Shall have default size of 2x2 cards plus padding around the cards of 20 pixels.
- minimum size is 1x1 card plus including padding.
- border shall be 1px dotted.
- Text label to centered on the top border line.
- Background color of the label shall be white, thus breaking the group border.
- clicking on the group border shall select the group and all cards within it.

## Select and moving elements

- Clicking on an empty space shall deselect all selected items.
- Clicking on an element while holding down the Ctrl key shall toggle that item into the selected items
- Dragging any selected item shall move all selected items to the position of the mouse cursor.
- Pressing the delete key shall delete all selected items.

## Text editor

- Clicking on any element containing text, shall start editing this text in place.

## Import / Export

- The separator character is `TAB` if more than one column is used.

### CSV file import

- Add toolbar item for importing CSV card files.
- Add toolbar item for importing CSV group files.
- Import functions shall show a file selection dialog.
- For import files, each line represents a card or group.
- Each card or group which doesn't exist in the canvas shall be created (match by text)
- automatically created elements shall be placed below the last existing element, ordering left to right, 5 cards per row.

### CSV file export

- Add toolbar item for exporting CSV card files.
- Add toolbar item for exporting CSV group files.
- Add toolbar item for exporting CSV mapping files.
- Export functions shall show a file save dialog.
- For export files, each line represents a card or group.
- For mapping files, the 1st column shall be the group, the 2nd column shall be the card.

## Observations

- canvas zoom is erratic
- frame selection is too simplified. See Selecting and moving elements for more details.
