/*
  FlexDash (https://github.com/raulcostajunior/flexDash)

  A jQuery UI plugin that implements a dashboard with editable bands (rows).

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

  version 1.0

  Dependencies:
    jQuery 1.7.1+,
    jQueryUI 1.9+ (module inclusion order is relevant)
        jquery.ui.core,
        jquery.ui.widget,
        jquery.ui.button,
        jquery.ui.mouse,
        jquery.ui.resizable,
        jquery.ui.draggable,
        jquery.ui.droppable,
    jQuery Resize Plugin (jquery.ba-resize.js: used to handle resizing of the dashboard container; available
                          at http://github.com/cowboy/jquery-resize/)
*/

(function ($) {

    $.widget("ui.flexDash", {

        options: {
            defaultColumnCount: 2,
            defaultHeight: 90,
            interWidgetHSpacing: 12,
            dragHelperZIndex: 10000,     // zIndex to be used for the draggable helper while being dragged around the
                                         // dashboard area.

            dragHelperOpacity: 0.80,     // Opacity to be used for the draggable helper while being dragged around the
                                         // dashboard area.

            baseWidgetUrl: '',           // Base Url to use when loading widget contents. Defaults to the empty string -
                                         // by default, all widget Urls are relative.

            fnConfirmWidgetDelete: null, // A callback for confirming widget removal. Receives the widget whose removal is
                                         // being confirmed. The callback should return a Promise object. If the Promise
                                         // is resolved the widget removal takes place. If it is rejected, the widget 
                                         // removal is cancelled.

            fnEditWidget: null,          // A callback for editing widget attributes. Receives the widget whose edition
                                         // has been requested. If the callback returns true, the Flex Dashboard assumes
                                         // the widget attributes have been edited and refreshes the widgets contents.
                                         // If the callback returns false, the Flex Dashboard assumes the edition has
                                         // been cancelled and no changes have been performed on the widget attributes.

            fnDisplayWidgetInfo: null    // A callback for displaying information about a widget. Receives the widget
                                         // whose information should be displayed. The return value of the callback is
                                         // ignored by the Flex Dashboard.
        },

        _getColCountSelectorHtml: function() {
            return (
                '<div id="dashColumnCountSelector">' +
                    '<input type="button" value="1" class="dashColumnCountBtn"/>' +
                    '<input type="button" value="2" class="dashColumnCountBtn"/>' +
                    '<input type="button" value="3" class="dashColumnCountBtn"/>' +
                '</div>');
        },

        _getDashSlotHtml: function(idxBand) {
            return (
                '<div class="dashSlot" data-bandIndex="' + idxBand + '">' +
                '</div>'
              )
        },

        _getWidgetHtml: function(dashWidget) {
            return (
                '<div class="dashWidget" id="widget_'+ dashWidget.id + '">' +
                    '<div class="dashWidget-header">' +
                        '<div class="dashWidget-toolbar" data-widgetId="' + dashWidget.id + '">' +
                           '<button class="dashWidget-captionBtn dashWidget-refreshBtn"></button>' +
                           '<button class="dashWidget-captionBtn dashWidget-editBtn"></button>' +
                           '<button class="dashWidget-captionBtn dashWidget-infoBtn"></button>' +
                           '<button class="dashWidget-captionBtn dashWidget-deleteBtn"></button>' +
                        '</div>' +
                        '<div class="dashWidget-caption">' + dashWidget.title + '</div>' +
                    '</div>' +
                    '<div class="dashWidget-body">' +
                        '<div class="dashWidget-contents" id="widget_' + dashWidget.id + '_contents">&nbsp;</div>' +
                    '</div>' +
                '</div>'
                );
        },

        _initDashSlotHtml: function(idxBand) {
            var dashSlot$;
            var last_band_widget$;
            if (this.bands[idxBand].widgets.length < 1) {
                return
            }
            else {
                dashSlot$ = $(this.bands[idxBand].bandElement).children('.dashSlot').last();
                last_band_widget$ = $('#widget_' + this.bands[idxBand].widgets[this.bands[idxBand].widgets.length-1].id);
                dashSlot$.css('left',
                              this.options.interWidgetHSpacing +
                              parseInt(last_band_widget$.css('left')) + parseInt(last_band_widget$.css('width')));
            }
        },

        _renderWidget: function (widgetElementId, renderUrl, widgetId) {
            $('#' + widgetElementId).children('.dashWidget-body').children('.dashWidget-contents').load(this.options.baseWidgetUrl + renderUrl + '/?idWidget=' + widgetId);
        },

        _repositionBandWidgets: function (idxBand) {
            var i, widget_element_id, previous_widget_element$;
            // Repositions all the widgets in the band horizontally.
            for (i = 0; i < this.bands[idxBand].widgets.length; i++) {
                widget_element_id = 'widget_' + this.bands[idxBand].widgets[i].id;
                if (i === 0)
                    $('#' + widget_element_id).css('left', 0);
                else
                {
                    previous_widget_element$ =
                        $('#widget_' + this.bands[idxBand].widgets[i-1].id);
                    $('#' + widget_element_id).css('left',
                                                   this.options.interWidgetHSpacing +
                                                   parseInt(previous_widget_element$.css('left')) +
                                                   parseInt(previous_widget_element$.css('width')));
                }
            }
        },

        _repositionAllBands: function () {
            var i;
            //console.log('Document window resized');
            for (i = 0; i < this.bands.length; i++) {
               this._repositionBandWidgets(i);
               //console.log('Repositioned widgets at band #' + i);
            }
        },

        _createDashSlots: function(draggableIdxBand) {
            var i;
            var self = this;

            if (this.inEditMode) return;

            //console.log('@ _createDashSlots(' + draggableIdxBand + ')');
            //console.log('    # of bands = ' + this.bands.length);

            for (i = 0; i < this.bands.length; i++) {
                if ((this.bands[i].widgets.length < this.bands[i].columnCount) &&
                    (i !== Number(draggableIdxBand))) {
                    // There's room for additional widgets in the band and it's not the
                    // band where the widget being dragged resides.
                    $(this.bands[i].bandElement).append(this._getDashSlotHtml(i));
                    this._initDashSlotHtml((i));
                }
            }

            // Appends an empty band to the dashboard and adds a slot to it if the widget
            // being dragged isn't the only widget of the last existing band.
            if (!(draggableIdxBand === this.bands.length-1 && this.bands[this.bands.length-1].widgets.length === 1)) {
                this._appendBand($(this.element));
                $(this.bands[this.bands.length-1].bandElement).append(this._getDashSlotHtml(this.bands.length-1));
                this._initDashSlotHtml(this.bands.length-1);
            }

            // Turns every dashSlot into a drop target
            $(this.element).find('.dashSlot').droppable({
                hoverClass: 'dashSlot-hover',
                drop: function(event, ui) {
                    self.dropped_widget_id  = ui.draggable.get(0).id;
                    self.idx_drop_band      = Number($(event.target).attr('data-bandIndex'));
                    //console.log('self.dropped_widget_id = ' + self.dropped_widget_id);
                    //console.log('self.idx_drop_band = ' + self.idx_drop_band);
                }
            })
        },

        _cleanUpDashSlots: function () {
            $(this.element).find('.dashSlot').remove();
            this._cleanUpEmptyBands();
        },

        _initWidget: function(dashWidget) {
            var self = this; // Stores a reference to the flexDashboard instance in self
            var widget_element_id = 'widget_' + dashWidget.id;
            var widget_element$ = $('#' + widget_element_id);
            $('#' + widget_element_id + ' .dashWidget-refreshBtn').button({ icons: { primary: 'ui-icon-refresh' }, text: false });
            $('#' + widget_element_id + ' .dashWidget-editBtn').button({ icons: { primary: 'ui-icon-pencil' }, text: false });
            $('#' + widget_element_id + ' .dashWidget-infoBtn').button({ icons: { primary: 'ui-icon-info' }, text: false });
            $('#' + widget_element_id + ' .dashWidget-deleteBtn').button({ icons: { primary: 'ui-icon-trash' }, text: false });

            // Every widget must be a draggable with reverse on invalid drop option
            widget_element$.draggable({
                revert: 'invalid',
                cursor: 'move',
                handle: '.dashWidget-caption',
                helper: 'original',
                opacity: self.options.dragHelperOpacity,
                zIndex: self.options.dragHelperZIndex,
                start: function(event) {
                    var widget_info = self._getInternalWidgetInfo(event.target.id);
                    self._createDashSlots(widget_info.idx_widget_band);
                    self.dropped_widget_id = null;
                    self.idx_drop_band = null;
                },
                stop: function () {
                    if (self.dropped_widget_id) {
                        var dragged_widget_html = $('#' + self.dropped_widget_id).html();
                        var dragged_widget_info = self._getInternalWidgetInfo(self.dropped_widget_id);
                        self.bands[dragged_widget_info.idx_widget_band].widgets.splice(dragged_widget_info.idx_widget_in_band,1);
                        $('#' + self.dropped_widget_id).remove();
                        $(self.bands[self.idx_drop_band].bandElement).children('.dashSlot').remove();
                        self._repositionBandWidgets(dragged_widget_info.idx_widget_band);
                        self.bands[self.idx_drop_band].widgets.push(dragged_widget_info.widget_data);
                        $(self.bands[self.idx_drop_band].bandElement).append(
                             '<div id="' + self.dropped_widget_id + '" class="dashWidget">' +
                                  dragged_widget_html +
                             '</div>');
                        self._initWidget(dragged_widget_info.widget_data, self.idx_drop_band);
                        self._repositionBandWidgets(self.idx_drop_band);
                        self._cleanUpEmptyBands();
                        //console.log('flexDash.stopDrag: vai disparar "changed"');
                            self._trigger('changed');
                    }
                    self._cleanUpDashSlots();
                }
            }).disableSelection();            
            this._renderWidget('widget_' + dashWidget.id, dashWidget.renderUrl, dashWidget.id);
        },

        _updateBandLayout: function (idxBand) {
            var band = this.bands[idxBand];
            var band_element$ = $(this.bands[idxBand].bandElement);
            band_element$.removeClass('dashBand-1col dashBand-2col dashBand-3col');
            switch (Number(band.columnCount)) {
                case 1:
                    band_element$.addClass('dashBand-1col');
                    break;
                case 2:
                    band_element$.addClass('dashBand-2col');
                    break;
                case 3:
                    band_element$.addClass('dashBand-3col');
                    break;
            }
            this._repositionBandWidgets(idxBand);
        },

        _updateBandsHeights: function () {
            var i;
            var band_element;

            for (i = 0; i < this.bands.length; i++) {
                band_element = this.bands[i].bandElement;
                this.bands[i].height = parseInt($(band_element).css('height'));
            }

        },

        _updateColCountSelector: function(bandElement) {
            var colCountSelector$ =  $('#dashColumnCountSelector');
            $(colCountSelector$).children('.dashColumnCountBtn').removeAttr('disabled');
            if ($(bandElement).hasClass('dashBand-1col'))
                $(colCountSelector$).children('.dashColumnCountBtn')[0].setAttribute('disabled','disabled');
            else if ($(bandElement).hasClass('dashBand-2col'))
                $(colCountSelector$).children('.dashColumnCountBtn')[1].setAttribute('disabled','disabled');
            else if ($(bandElement).hasClass('dashBand-3col'))
                $(colCountSelector$).children('.dashColumnCountBtn')[2].setAttribute('disabled','disabled');
        },

        _appendBand: function (bandsContainer) {
            $(bandsContainer).append('<div class="dashBand" style="height: ' + this.options.defaultHeight + 'px"></div>');
            this.bands.push({
                columnCount: this.options.defaultColumnCount,
                height: this.options.defaultHeight,
                widgets: [],
                bandElement: $(bandsContainer).children('.dashBand').last()
            })
            this._updateBandLayout(this.bands.length-1);
        },

        _insertBand: function (bandsContainer, idx, columnCount, widgets) {
            var i;
            var band_element = this.bands[idx].bandElement;
            $(band_element).after('<div class="dashBand" style="height: ' + this.options.defaultHeight + 'px"></div>');
            this.bands.splice(idx+1, 0, {
                columnCount: columnCount,
                height: this.options.defaultHeight,
                widgets: widgets,
                bandElement: $(bandsContainer).children('.dashBand').get(idx+1)
            })
            for (i = 0; i < widgets.length; i++)
            {
                $(this.bands[idx+1].bandElement).append(this._getWidgetHtml(widgets[i]));
                this._initWidget(widgets[i]);
                this._repositionBandWidgets(idx+1);
            }
        },

        _getInternalWidgetInfo: function(widgetElementId) {
             // Retrieves the attributes of the widget from the internal bands
             // data structure
             var i, j;
             var idx_widget_band, idx_widget_in_band, widget_data;
             search_loop:
             for (i = 0; i < this.bands.length; i++) {
                 for (j = 0; j < this.bands[i].widgets.length; j++) {
                     if (String('widget_' + this.bands[i].widgets[j].id) === String(widgetElementId)) {
                         idx_widget_band = i;
                         idx_widget_in_band = j;
                         widget_data = this.bands[i].widgets[j];
                         break search_loop;
                     }
                 }
             }
            return {
                widget_data: widget_data,
                idx_widget_band: idx_widget_band,
                idx_widget_in_band: idx_widget_in_band
            }
        },

        _widgetExists: function(widgetElementId) {
          // Returns true if the dashboard already has a widget with the given id
            var widget_info = this._getInternalWidgetInfo(widgetElementId);
            return Boolean(widget_info.widget_data);
        },

        _cleanUpEmptyBands: function() {
            var i, empty_band_found;
            if (this.bands.length <= 1) {
                //There´s just one band - it can be empty
                return;
            }
            for (i = 0; i < this.bands.length; i++) {
                if (this.bands[i].widgets.length === 0) {
                    $(this.bands[i].bandElement).remove();
                }
            }
            do
            {
                empty_band_found = false;
                for (i = 0; i < this.bands.length; i++) {
                    if (this.bands[i].widgets.length === 0) {
                        this.bands.splice(i, 1);
                        empty_band_found = true;
                        break;
                    }
                }
            } while( empty_band_found && this.bands.length > 1);
        },

        _deleteWidget: function (widget_context) {
            // Removes the widget entry from both the DOM and from the internal
            // flexDash component data structure.
            this.bands[widget_context.idx_widget_band].widgets.splice(widget_context.idx_widget_in_band, 1);
            //console.log('flexDash._deleteWidget: apagou widget na banda');
            $('#' + widget_context.widget_element_id).remove();

            this._repositionBandWidgets(widget_context.idx_widget_band);
            this._cleanUpEmptyBands();

            //console.log('flexDash._deleteWidget: vai disparar "changed"');
            this._trigger('changed');
        },

        _create: function() {
            var self = this;

            this.bands = [];
            this.inEditMode = false;
            this._appendBand($(this.element));

            function getWidgetInfoFromCommandButton(cmdBtnElement) {
                var widget_id =  $(cmdBtnElement).parent()[0].getAttribute('data-widgetId');
                var widget_element_id = 'widget_' + widget_id;
                var widget_context = self._getInternalWidgetInfo(widget_element_id);
                return {
                    id: widget_context.widget_data.id,
                    title: widget_context.widget_data.title,
                    renderUrl: widget_context.widget_data.renderUrl,
                    idx_widget_in_band: widget_context.idx_widget_in_band,
                    idx_widget_band: widget_context.idx_widget_band,
                    widget_element_id: widget_element_id
                }
            }

            // Handles command "Refresh Widget"
            $(this.element).on('click', '.dashWidget-refreshBtn', null, function () {
                if (self.inEditMode) return;

                var widget_context = getWidgetInfoFromCommandButton(this);

                self._renderWidget(widget_context.widget_element_id, widget_context.renderUrl, widget_context.id);
            });

            // Handles command "Delete Widget"
            $(this.element).on('click','.dashWidget-deleteBtn', null, function() {
                if (self.inEditMode) return;

                var execute_delete;
                var widget_context = getWidgetInfoFromCommandButton(this);

                if (self.options.fnConfirmWidgetDelete) {
                    //console.log('em flexDash.deleteHandler -> chamando callback de confirmação de remoção');
                    $.when(self.options.fnConfirmWidgetDelete(widget_context)).then(
                        function () { /*alert('em "resolve" de flexDash.deleteHandler');*/ self._deleteWidget(widget_context) })
                }
                else {
                    execute_delete = confirm('Remove Widget "' + widget_context.title + '" ?');
                    if (execute_delete) {
                        self._deleteWidget(widget_context);
                    }
                }
            });

            // Handles command "Edit Widget"
            $(this.element).on('click', '.dashWidget-editBtn', null, function() {
                if (self.inEditMode) return;

                var widget_context = getWidgetInfoFromCommandButton(this);
                var widget_edited = false;

                if (self.options.fnEditWidget) {
                    widget_edited = self.options.fnEditWidget(widget_context);
                }

                if (widget_edited) {
                    self._renderWidget(widget_context.id, widget_context.renderUrl, widget_context.id);
                }
            });

            // Handles command "Display Widget Info
            $(this.element).on('click','.dashWidget-infoBtn', null, function(){
                if (self.inEditMode) return;

                var widget_context = getWidgetInfoFromCommandButton(this);

                if (self.options.fnDisplayWidgetInfo) {
                    self.options.fnDisplayWidgetInfo(widget_context);
                }
                else {
                    alert('Widget Info:\r\n\r\nId: "' +
                           widget_context.id + '"\r\n' +
                           'Title: "' + widget_context.title + '"\r\n' +
                           'RenderUrl: "' + widget_context.renderUrl + '"');
                }
            });

            // Handles band selection while in Band Edit Mode
            $(this.element).on('click', '.dashBand-edit', null, function () {
                var colCountSelector$ =  $('#dashColumnCountSelector');
                colCountSelector$.slideUp('fast');
                colCountSelector$.remove();
                $('.dashBand-selected').resizable('destroy');
                $(self.element).children('.dashBand').removeClass('dashBand-selected');
                $(self.element).children('.dashBand').addClass('dashBand-edit');
                $(this).removeClass('dashBand-edit');
                $(this).addClass('dashBand-selected');
                $('.dashBand-selected').resizable({
                    handles: 's', distance: 0, grid: [1000,1],
                    maxWidth: $(this).css('width'),
                    minWidth: $(this).css('width'),
                    start: function (event, ui) {
                        //console.log('start: ui.originalSize.width = ' + ui.originalSize.width);
                        //console.log('start: ui.size.width = ' + ui.size.width);
                            },
                    stop: function (event, ui) {
                        //console.log('stop: ui.originalSize.width = ' + ui.originalSize.width);
                        //console.log('stop: ui.size.width = ' + ui.size.width);

                        self._updateBandsHeights();
                        self._repositionAllBands();   

                        var elements = $(".dashBand-selected .dashWidget").length;
                        if (elements > 0)
                        {
                            var w = $(".dashBand-selected .dashWidget");
                            var widget = self._getInternalWidgetInfo($(w).attr('id'));
                            var idxBandSelect = widget.idx_widget_band;
                            var widgetsBand = $(self.bands[idxBandSelect].widgets);
                                //Refresh all widgets inside the Band.
                                $.each(widgetsBand, function (i, v) {
                                    self.refreshWidget(v.id);
                                }); 
                        }
                        

                        //console.log('flexDash.onBandResizeStop: vai disparar "changed"');
                        self._trigger('changed');
                    }
                });
                $(this).append(self._getColCountSelectorHtml());
                self._updateColCountSelector(this);
                colCountSelector$ = $('#dashColumnCountSelector');
                colCountSelector$.hide();
                colCountSelector$.css('top', 5);
                colCountSelector$.css('right', 5);
                colCountSelector$.fadeIn('medium');
            });

            // Handles activation of command "Set band column count"
            $(this.element).on('click', '.dashColumnCountBtn', null, function () {
               
               var i, j,
                   idx_band = -1;
               var exceeding_widgets = [];
               var new_col_count = $(this).attr('value');
               for (i = 0; i < self.bands.length && idx_band < 0; i++) {
                   // this is the button the user has pressed; it´s contained in the
                   // #dashColumnCountSelector, which is contained in the band to be
                   // edited div.
                   if ($(self.bands[i].bandElement).first().is($(this).parent().parent())) {
                       idx_band = i;
                   }
               }
               if (idx_band < 0) {
                   console.error('Couldn\'t find band in internal bands collection');
                   return;
               }

               if (new_col_count < self.bands[idx_band].widgets.length) {
                   // Special case - in its new configuration, the band won't be able to hold all
                   // the widgets it already contains. Add new band and move the exceeding widgets
                   // into it.
                   for (i = 0; i < (self.bands[idx_band].widgets.length - new_col_count); i++) {
                       exceeding_widgets.push(self.bands[idx_band].widgets[self.bands[idx_band].widgets.length-1-i]);
                       $('#widget_' + exceeding_widgets[i].id).remove();
                   }
                   for (i = 0; i < exceeding_widgets.length; i++) {
                       for (j = 0; j < self.bands[idx_band].widgets.length; j++) {
                           if (exceeding_widgets[i].id === self.bands[idx_band].widgets[j].id) {
                               self.bands[idx_band].widgets.splice(j,1);
                               break;
                           }
                       }
                   }
                   self._insertBand($(self.element), idx_band, 3, exceeding_widgets);
                   self._updateBandLayout(idx_band+1);
                   $(self.bands[idx_band+1].bandElement).addClass('dashBand-edit');
               }

               self.bands[idx_band].columnCount = new_col_count;
               self._updateBandLayout(idx_band);
               self._updateColCountSelector(self.bands[idx_band].bandElement);

                //Refresh all widgets inside the Band.
               $.each(self.bands[idx_band].widgets, function (i, v) {
                   self.refreshWidget(v.id);
               });

               //console.log('flexDash.onBandColumnCountSet: vai disparar "changed"');
               self._trigger('changed');
            });

            // Handles resizing of Flex Dashboard containing element
            $(this.element).on('resize', function() {
               self._repositionAllBands();
            });
        },

        _addWidgetInBand: function (dashWidget, idxBand) {
            if (this.inEditMode) return;

            if (idxBand >= this.bands.length) {
                console.error('There\'s no band with index "' + idxBand + '" in the dashboard');
                return;
            }

            this.bands[idxBand].widgets.push(dashWidget);
            $(this.bands[idxBand].bandElement).append(this._getWidgetHtml(dashWidget));
            this._initWidget(dashWidget);
            this._repositionBandWidgets(idxBand);
        },

        clearDashboard: function () {
            if (this.inEditMode) {
                this.leaveBandEditMode();
            }
            this._cleanUpDashSlots();
            $(this.element).children('.dashBand').remove();
            this.bands = [];
            this._appendBand($(this.element));
        },

        addWidget: function (dashWidget) {
            var i;

            if (this.inEditMode) return;

            if (this._widgetExists(dashWidget.id)) {
                console.error('The dashboard already contains a widget with id "' + dashWidget.id + '". Widget could not be added.');
                return;
            }

            for (i = 0; i < this.bands.length; i++) {
                if (this.bands[i].widgets.length < this.bands[i].columnCount) {
                    // there's room for the new widget
                    this.bands[i].widgets.push(dashWidget);
                    $(this.bands[i].bandElement).append(this._getWidgetHtml(dashWidget));
                    this._initWidget(dashWidget);
                    this._repositionBandWidgets(i);
                    //console.log('flexDash.addWidget: vai disparar "changed"');
                    this._trigger('changed');
                    return;
                }
            }

            // there was no room for the new widget in the existing bands.
            this._appendBand($(this.element));
            this.bands[this.bands.length-1].widgets.push(dashWidget);
            $(this.bands[this.bands.length-1].bandElement).append(this._getWidgetHtml(dashWidget));
            this._initWidget(dashWidget);
            this._repositionBandWidgets(this.bands.length - 1);
            //console.log('flexDash.addWidget: vai disparar "changed"');
            this._trigger('changed');
        },

        updateWidgetTitle: function (idWidget, widgetTitle) {
            var i, j;
            search_loop:
                for (i = 0; i < this.bands.length; i++) {
                    for (j = 0; j < this.bands[i].widgets.length; j++) {
                        if (String(this.bands[i].widgets[j].id) === String(idWidget)) {
                            if (String(this.bands[i].widgets[j].title) !== String(widgetTitle)) {
                                this.bands[i].widgets[j].title = widgetTitle;
                                //console.log('flexDash.updateWidgetTitle: vai disparar "changed"');
                                this._trigger('changed');
                            }
                            break search_loop;
                        }
                    }
                }
        },

        refreshWidget: function(idWidget) {
            var widget_element_id = 'widget_' + idWidget;
            var widget_info = this._getInternalWidgetInfo(widget_element_id);
            this._renderWidget(widget_element_id, widget_info.widget_data.renderUrl, idWidget);
        },

        enterBandEditMode: function() {
            $(this.element).children('.dashBand').addClass('dashBand-edit');
            $('.dashWidget-captionBtn').button('disable');
            this.inEditMode = true;
        },

        leaveBandEditMode: function() {
            $(this.element).children('.dashBand').removeClass('dashBand-edit');
            $(this.element).children('.dashBand').removeClass('dashBand-selected');
            $('#dashColumnCountSelector').css('display', 'none');
            $('.dashWidget-captionBtn').button('enable');
            $('.dashBand-selected').resizable('destroy');
            this.inEditMode = false;
        },

        loadFromJson: function (dashJson) {
            var i, j, saved_bands;
            if (this.inEditMode) return;
            if (dashJson) {
                for (i = 0; i < this.bands.length; i++) {
                    this.bands[i].widgets.splice(0, this.bands[i].widgets.length);
                };
                this.bands.splice(0, this.bands.length);
                $('.dashBand').remove();
                saved_bands = JSON.parse(dashJson);
                for (i = 0; i < saved_bands.length; i++) {
                    this._appendBand($(this.element));
                    this.bands[this.bands.length-1].height = saved_bands[i].height;
                    this.bands[this.bands.length-1].columnCount = saved_bands[i].columnCount;
                    this.bands[this.bands.length-1].bandElement.css('height', saved_bands[i].height);
                    this._updateBandLayout(this.bands.length-1);
                    for (j = 0; j < saved_bands[i].widgets.length; j++) {
                        this._addWidgetInBand(saved_bands[i].widgets[j], i);
                    }
                }
            }
            //console.log('flexDash.loadFromJson: vai disparar "changed"');
            this._trigger('changed');
        },

        asJson: function() {
            return JSON.stringify(this.bands,['columnCount', 'height', 'widgets', 'id', 'title', 'renderUrl']);
        }

    });

})(jQuery);
