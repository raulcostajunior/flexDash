# flexDash
A JQueryUI plugin for creating user customizable dashboard pages composed of multiple widgets (similar to MyYahoo.com, Start.Me and Protopage.com).

The dashboard is composed of widgets arranged in bands. Each band can have between 1 and 3
columns and its own height. Both the number of columns and the height of each band can be
interactively edited by the user.

Widgets are delimited areas, resembling standard windows, that can be drag-n-dropped around
the dashboard. Each widget has a caption that hosts buttons for triggering edit, delete and
display info actions. It´s up to the component host application to provide handlers to
execute each of the actions required by the user - the Flex Dashboard calls a host provided
callback for each action requested by the interacting user. 

Any modification to the dashboard lay-out or contents triggers a 'changed' event. One can
use an event handler for the 'changed' event to persist the current dashboard configuration.
The 'loadFromJson' initializes the dashboard from given JSON formatted configuration. The 
'asJson' serializes the current dashboard configuration to a JSON formatted string.

## Dependencies:
    jQuery 1.7.1+,
    jQueryUI 1.9+ (module inclusion order is relevant)
    jQuery Resize Plugin (http://github.com/cowboy/jquery-resize/)
