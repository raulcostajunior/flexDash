# flexDash
A JQueryUI plugin for creating dashboard pages similar to "MyYahoo.com", "Start.Me" and "Protopage.com". 

The dashboard is composed of widgets arranged in horizontal bands. Each band can have between 1 and 3
columns. The height of each band can be set interactively by an user.

Widgets are delimited areas, resembling standard windows, that can be drag-n-dropped around
the dashboard. Each widget has a caption that hosts buttons for triggering "Edit", "Delete", 
"Display Info" and "Refresh" actions. The flexDash client application is responsible for providing handler functions for each action. More specifically, flexDash invokes callback functions provided by the client application for each action requested by the interacting user. 

Any modification to the dashboard lay-out or to the dashboard contents triggers a "changed" event. 
The "loadFromJson" method sets the dashboard state to the state previously serialized into a given JSON configuration. The "asJson" method goes the opposite way, serializing the current dashboard state to a JSON configuration.

## Dependencies
    jQuery 1.7.1+,
    jQueryUI 1.9+,
    jQuery Resize Plugin (http://github.com/cowboy/jquery-resize/)
    
## Demo

There's a demo of flexDash at https://raulcostajunior.github.io/flexDash/flexDashDemo.html.
    

