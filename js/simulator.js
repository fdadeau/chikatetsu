document.addEventListener("DOMContentLoaded", function() {

    /***************************************************************
     *                      Data model
     ***************************************************************/
    
    // main data: network, fares, etc.
    let network = new Network(Sapporo);
    let fares = {   "0.0": 200, 
                    "03.01": 250,
                    "07.01": 290,
                    "11.01": 320,
                    "15.01": 350,
                    "19.01": 370 };
    
    let station0 = network.getStationByName("Sapporo");
    
    // visualization data
    var HEIGHT = 0; 
    var WIDTH = 0; 
    var BOTTOM = 0;
    
    // GUI variables
    let characters = new CharacterGUI();
    let map = new MapGUI(station0);
    let station = new StationGUI(station0);
    let travel = new TravelGUI();
    let ticketMachine = new TicketMachineGUI();
    
    
    
    /***************************************************************
     *                      Events in the GUI
     ***************************************************************/
    
    // recomputation of reference sizes when resize
    window.addEventListener("resize", function(_e) {
        if (station.element.previousElementSibling.checked) {
            HEIGHT = station.element.clientHeight;
            WIDTH = station.element.clientWidth;  
            BOTTOM = HEIGHT * 100 / WIDTH; 
        }
    });
     
    
    
    /***************************************************************
                        GUI for characters
    ***************************************************************/    

    /**
     *  Class representing a set of characters. 
     */
    function CharacterGUI() {
    
        /** Set of characters **/
        this.characters = [];
        
        /** The currently selected character **/
        this.current = null;
    
        let index = 0;
        
        /**
         *  Adds a character to the current set of characters. 
         *  @param      Station     st  the current station in which the character is created.
         */
        this.addCharacter = function(st, sprite) {
            let newChar = new Character(st, sprite);
            newChar.element.id = "user" + (index++);
            this.characters.push(newChar);
            return newChar;
        }
        
        /**
         *  Removes a character from the set of characters.
         *  @param  Character   c   the character to remove
         */
        this.removeCharacter = function(c) {
            if (c.state != 1) {
                return;   
            }
            this.select(c);
            c.state = 5;
            c.goTo(c.position.x, BOTTOM + 8, function() {
                c.element.parentNode.removeChild(c.element);
                this.characters.splice(this.characters.indexOf(c), 1);
            }.bind(this));
        }
         
        /**
         *  Selects/unselects the character in parameter.
         *  
         */
        this.select = function(c) {
            // currently selected character
            if (this.current != null) {
                this.current.select(); 
                // if re-selects --> remove selection and return
                if (this.current == c) {
                    station.element.classList.remove("selected");
                    this.current = null;
                    return;
                }
            }
            // newly selected character
            this.current = c;
            this.current.select();
            station.element.classList.add("selected");
        }
        
        /** 
         *  Adds the characters to the current station (in parameter)
         */
        this.displayInStation = function(st) {
            this.characters.forEach(function(c) {
                if (c.station == st) {
                    station.element.appendChild(c.element);
                }
            });
        }
        
        /**
         *  Retrieves the current character from its HTML element. 
         */
        this.getCharacterFromElement = function(elt) {
            for (let char of this.characters) {
                if (char.element == elt) {
                    return char;
                }
            }
            return null;
        }
        
        
        
        /** 
         *  Re-evaluate character position.
         */
        this.updateDisplay = function(st) {
            this.characters.forEach(function(c) {
                if (c.station == st) {
                    c.update();   
                }
            });
        }
        
        
        /** 
         *  Click on the tickets 
         */
        document.getElementById("bcTickets").addEventListener("click", function(e) {
            // avoids propagation to the background elements
            e.stopPropagation();
            if (document.getElementById("radScreen").checked && ticketMachine.state == "FA0") {
                if (e.target.classList.contains("ticket")) {
                    let index = e.target.dataset.index;
                    let t = characters.current.removeTicket(index);
                    characters.current.updateTickets();
                    ticketMachine.insertTicket(t);
                }
                document.getElementById("cbTickets").checked = false;   
                return;
            }
            if (characters.current && characters.current.waitingForTicket > 0 && e.target.classList.contains("ticket")) {
                let index = e.target.dataset.index;
                let t = characters.current.tickets[index];
                document.getElementById("cbTickets").checked = false;
                characters.current.insertTicketInBarrier(t, characters.current.waitingForTicket);
                return;
            }
        });
        
        
        // click on the map button --> do nothing
        document.getElementById("btnMap").addEventListener("click", function(e) {
            e.preventDefault();
            map.close();
        });
            
        
    }
    
    /** 
     *  Class representing a character.
     *  @param  Station     st   Initial station in which the character starts.
     */
    function Character(st, sprite) {
    
        /** Station in which the character is located */
        this.station = st;
        
        /** Tickets bought by the character */
        this.tickets = [];
        
        /** Display information */
        this.position = {x: 0, y: 0};
        
        // movement speed
        this.INITIAL_SPEED = 0.3;
        this.speed = this.INITIAL_SPEED;
        
        const ARRIVING = 0, OUTSIDE = 1, GOING_IN = 2, INSIDE = 3, GOING_OUT = 4, LEAVING = 5;
        this.state = 0;
        this.waitingForTicket = 0;
        
        // Current destination of the character 
        this.destination = { vecX: null, vecY: null, x: null, y: null, after: null, turn: 0 };
        
        // Definition of the sprite element  
        this.element = document.createElement("div");
        this.element.classList.add("sprite");
        this.element.classList.add(sprite ? sprite : ("sprite" + (Math.random() * 8 | 0)));
        // Positionnement initial  
        this.position.x = Math.random() * 80 + 10; 
        this.position.y = BOTTOM + 8; 
        

        /** 
         * Performs the entry of the character in the station (from the bottom of the station). 
         */ 
        this.entersStation = function() {
            this.element.style.left = this.position.x + "vw";
            this.element.style.top = this.position.y + "vw";            
            // add the child to the station
            station.element.appendChild(this.element);
            this.state = ARRIVING;
            // starts animation
            this.goTo(this.position.x, BOTTOM - 2, function() { this.state = OUTSIDE; }.bind(this));
        }
        
        
        /**
         *  Initiates movement to a given direction. 
         */
        this.goTo = function(destX, destY, after) {
            this.waitingForTicket = 0;
            this.destination.x = destX;
            this.destination.y = destY;
            this.destination.vecX = null;
            this.destination.after = after;
        }
        
        
        /**
         *  Inserts a ticket inside a barrier 
         *  @param  Ticket  t       the ticket to insert
         *  @param  int     index   the index of the barrier (1--6)
         */
        this.insertTicketInBarrier= function(t, index) {
            let bar = document.querySelector("footer > .barrier:nth-of-type(" + index + ")");
            // entering station (call to the API)
            let b = (station.barriers[index-1].deltaY > 0) ? station.barrier.exit(t) : station.barrier.enter(t);
            if (b) {
                bar.classList.add("ok");
                this.state = (station.barriers[index-1].deltaY > 0) ? GOING_OUT : GOING_IN;  
                // move character
                this.goTo(this.position.x, this.position.y + station.barriers[index-1].deltaY, function() {
                    bar.classList.remove("ok");
                    this.state = (this.state == GOING_OUT) ? OUTSIDE : INSIDE;
                }.bind(this));
            }
            else {
                bar.classList.add("ko");
                setTimeout(function(ba) { ba.classList.remove("ko"); }.bind(null, bar), 1000);
            }
            // this.updateTickets();
        }

        
        /**
         *  Updates the current character position.
         */
        this.update = function() {

            // if no motion --> return
            if (this.destination.x == null) {
                return; 
            }
            // compute distance
            let dist = distance(this.destination, this.position);
            // if too close // --> return 
            if (dist < 5 * 100 / WIDTH) {
                this.destination.x = null;
                this.destination.vecX = null;
                this.element.classList.remove("animation");
                this.orientation();
                if (this.destination.after) {
                    this.destination.after();
                }
                return;   
            }

            // if the character is not in motion
            if (this.destination.vecX == null) {
                // compute direction vector
                this.destination.vecX = (this.destination.x - this.position.x) / dist;
                this.destination.vecY = (this.destination.y - this.position.y) / dist;
                // determine orientation
                this.orientation(this.destination.vecX, this.destination.vecY);
                this.element.classList.add("animation");
                // remove turn
                this.destination.turn = 0;
            }
            
            // if turning around an obstacle
            if (this.destination.turn > 0) {
                // compute direction vector
                let vecX = (this.destination.x - this.position.x) / dist;
                let vecY = (this.destination.y - this.position.y) / dist;
                // determine orientation
                let b = station.isInZoneOK(this, this.position.x + this.speed * vecX, this.position.y + this.speed * vecY);
                if (station.isInZoneOK(this, this.position.x + this.speed * vecX, this.position.y + this.speed * vecY)) {
                    this.destination.vecX = vecX;
                    this.destination.vecY = vecY;
                    this.orientation(this.destination.vecX, this.destination.vecY);
                    this.destination.turn = 0;
                }
            }
                        
            
            // compute next position
            let nextX = this.position.x + this.speed * this.destination.vecX;
            let nextY = this.position.y + this.speed * this.destination.vecY;
            
            
            // check next position
            if (! station.isInZoneOK(this, nextX, nextY)) {
                // if already turning around --> invert movement
                if (this.destination.turn > 0) {
                    this.destination.vecX = -this.destination.vecX;
                    this.destination.vecY = -this.destination.vecY;
                }
                // otherwise check if he can move horizontally
                else if (station.isInZoneOK(this, nextX, this.position.y)) {
                    this.destination.vecX = this.destination.vecX > 0 ? 1 : -1;
                    this.destination.vecY = 0;
                    this.destination.turn = 1;
                }
                // otherwise check if he can move vertically
                else if (station.isInZoneOK(this, this.position.x, nextY)) {
                    this.destination.vecX = 0;
                    this.destination.vecY = this.destination.vecY > 0 ? 1 : -1;
                    this.destination.turn = 2;
                }
                this.orientation(this.destination.vecX, this.destination.vecY);
                return;
            }
            
            // if obstacle, move the character
            this.position.x = nextX;
            this.position.y = nextY;
            // update element display
            this.element.style.top = nextY + "vw";
            this.element.style.left = nextX + "vw";
            this.element.style.zIndex = nextY * 10 | 0;
        }
        
        
        function distance(p1, p2) {
             return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
        }

        /** Set the character orientation */
        this.orientation = function(vecX, vecY) {
            this.element.classList.remove("arretD");   
            this.element.classList.remove("arretG");   
            this.element.classList.remove("arretH");   
            this.element.classList.remove("arretB");
            this.element.classList.remove("marcheD");   
            this.element.classList.remove("marcheG");   
            this.element.classList.remove("marcheH");   
            this.element.classList.remove("marcheB");
            if (this.destination.x == null || this.speed < 0.1) {
                this.element.classList.add("arret" + (this.destination.vecY < -0.5 ? "H" : "B"));   
                return;
            }
            if (vecX > 0.5) {
                this.element.classList.add("marcheD");
                return;
            }
            if (vecX < -0.5) {
                this.element.classList.add("marcheG");
                return;
            }
            if (vecY > 0.5) {
                this.element.classList.add("marcheB");
                return;
            }
            this.element.classList.add("marcheH"); 
        }
        
        
        /** 
         *  Selects this character 
         */
        this.select = function() {
            this.element.classList.toggle("selected");
            if (this.isSelected()) {
                this.updateTickets();
            }
        }
        /**
         *  Checks if the character is selected. 
         */
        this.isSelected = function() {
            return this.element.classList.contains("selected");   
        }
        
        
        /** 
         *  Triggered when the character is about to enter the train. 
         *  --> animation to get down stairs
         *  @param  String      line    the selected line name
         *  @param  int         dir     the direction
         */
        this.entersTrain = function(line, dir) {
            this.state = GOING_IN;
            this.goTo(this.position.x, this.position.y + 3, function() {
                this.speed = 0.03;
                this.goTo(this.position.x, this.position.y + 9, travel.startTravel.bind(travel, station.station.name, line, dir));    
            }.bind(this));
        }
        
        /** 
         *  Triggered when the character exits the train. 
         *  --> animation to get down stairs
         *  @param  Station     st      the station in which the character arrives
         *  @param  Line        line    the line from which (s)he comes from
         *  @param  int         dir     the direction (-1 / +1)
         */
        this.exitsTrain = function(st, line, dir) {
            this.station = st;
            let infos;
            if (this.station.lines[line.name].number == 1) {
                infos = station.escalators["inc" + line.name];
            }
            else if (this.station.lines[line.name].number == line.stations.length) {
                infos = station.escalators["dec" + line.name];
            }
            else {
                infos = station.escalators[(dir > 0 ? "inc" : "dec") + line.name];
            }
            this.position.x = infos.x - 7.4;
            this.position.y = infos.y + 12;
            this.element.style.top = this.position.y + "vw";
            this.element.style.left = this.position.x + "vw";
            this.element.style.zIndex = this.position.y * 10 | 0;
            station.element.appendChild(this.element);
            this.goTo(this.position.x, this.position.y - 9, function() {
                this.speed = this.INITIAL_SPEED;
                this.goTo(this.position.x, this.position.y - 5, function() {
                    this.state = INSIDE;
                }.bind(this));
            }.bind(this));
        }
        
                
        /**
         *  Adds the ticket in parameter. 
         *  @param  Ticket  t   the ticket to add. 
         */
        this.addTicket = function(t) {
            this.tickets.push(t);
        }
        
        /**
         *  Removes the ticket at the specified index.
         *  @param  int     i   the index in which the ticket is located.
         */
        this.removeTicket = function(i) {
            let t = this.tickets[i];
            this.tickets.splice(i, 1);
            return t;
        }
         
        /**
         *  Displays the tickets that the user possesses. 
         */
        this.updateTickets = function() {
            document.getElementById("btnTickets").dataset.number = this.tickets.length;   
            let html = "";
            if (this.tickets.length == 0) {
                html = "<p>No tickets.</p>";   
            }
            else {
                let index = 0;
                this.tickets.forEach(function(t) {
                    let label = "";
                    if (t.date) {
                        label = network.getStationByName(t.label).jp + " " + t.date.toISOString().substr(11,8);
                        if (! t.isValid()) {
                            label = "<span style='text-decoration: line-through;'>" + label + "</span>";   
                        }
                    }
                    html += "<div class='ticket' data-index='" + index + "' data-fare='" + t.getAmount() 
                        + "' data-child='" + (t.isChild() ? 1 : 0) + "'>" + label + "</div>";
                    index++;
                });
            }
            document.querySelector("#bcTickets > div").innerHTML = html;
        }
    }
    
    
    
    /***************************************************************
                        GUI for the station 
    ***************************************************************/    

    /**
     *  GUI for the station display and interaction.
     *  @param  Station     initialStation  Initial station that is displayed.
     */
    function StationGUI(initialStation) {
            
        /** Corresponding HTML element */ 
        this.element = document.querySelector("main");
        
        /** The currently displayed station */
        this.station = initialStation;
        
        /** Barrier associated to the station (will be used for all transactions) */
        this.barrier = new Barrier(network, initialStation, fares);
        
        /** Zones where the player can go */
        this.zonesOK = [];
        /** Barriers in the station */
        this.barriers = [];
        /** Machines in the station */
        this.machines = [];
        /** Escalators in the station */
        this.escalators = {};

        /** Set of panels */
        let panels = []; 
        /** Panels revalidation (computation of their bounds) **/
        this.revalidatePanels = function() {
            var ratio = scrollY / (HEIGHT - window.innerHeight);
            for (var i=0; i < panels.length; i++) {
                panels.item(i).style.marginTop = (ratio * 3) + "vw";
            }
        }
        

        /************************************************************
                    Events: clicks on the "main" element
        *************************************************************/
        this.element.addEventListener("click", function(e) { 

            e.stopPropagation();

            // click on the ticket button --> do nothing
            if (e.target.id == "btnTickets") {
                if (characters.current.state != 1 && characters.current.state != 3) {
                    return;
                }
                characters.current.updateTickets();
                return;
            }   
            
            // if tickets are visible, prevent any actions on the background 
            if (document.getElementById("cbTickets").checked) {
                return;
            }
            
            // click on addCharacter button 
            if (e.target.id == "btnAddCharacter") {
                let sprite = e.target.classList.item(0);
                let c = characters.addCharacter(station.station, sprite);
                e.target.classList.remove(sprite);
                e.target.classList.add("sprite" + (Math.random()*8 | 0));
                characters.select(c);
                c.entersStation();
                return;
            }
            
            // click on exit 
            if (e.target.id == "btnExit") {
                if (characters.current.state == 1) {
                    characters.removeCharacter(characters.current);
                }
            }
            
            // click on sprite
            if (e.target.classList.contains("sprite")) {
                let c = characters.getCharacterFromElement(e.target);
                // if in movement, impossible to change
                if (c == null || c.destination.vecX != null) {
                    return;
                }
                characters.select(c);   
                return;
            }
            
            // click on escalator
            if (e.target.classList.contains("down")) {
                // check that a character is selected 
                if (! characters.current) {
                    return;
                }
                if (characters.current.state != 3) {
                    return;
                }
                let esc = e.target.parentElement;
                let infos = station.escalators[esc.dataset.id];
                characters.current.goTo(infos.x, infos.y, characters.current.entersTrain.bind(characters.current, infos.line, infos.dir)); 
                return;
            }
            
            // click on ticket vending machine
            if (e.target.classList.contains("TVM")) {
                // check that a character is selected 
                if (! characters.current) {
                    return;
                }
                // check that character is in the appropriate "zone" to reach TVM
                let index = 1 * e.target.dataset.index;
                if (station.machines.TVM[index].required != characters.current.state) {
                    return;
                }
                // move character to the appropriate point
                characters.current.goTo(station.machines.TVM[index].x, station.machines.TVM[index].y, function() {
                    // force orientation towards top
                    characters.current.destination.vecY = -1;
                    characters.current.orientation(0, -1);
                    ticketMachine.displayTicketVending(); 
                });
                return;
            }
            
            // click on fare adjustment machine
            if (e.target.classList.contains("FAM")) {
                // check that a character is selected 
                if (! characters.current) {
                    return;
                }
                // check that character is in the appropriate "zone" to reach FAM
                let index = 1 * e.target.dataset.index;
                if (station.machines.FAM[index].required != characters.current.state) {
                    return;
                }
                // move character to the appropriate point
                characters.current.goTo(station.machines.FAM[index].x, station.machines.FAM[index].y, function() {
                    characters.current.destination.vecY = -1;
                    characters.current.orientation(0, -1);
                    ticketMachine.displayFareAdjustment(); 
                });
                return;
            }
            
            // click on barrier
            if (e.target.classList.contains("barrier")) {
                // check that a character is selected 
                if (! characters.current) {
                    return;
                }
                // if barrier is in use 
                if (e.target.classList.contains("ko") || e.target.classList.contains("ok")) {
                    return;   
                }
                // check that character is in the appropriate "zone" to reach barrier
                let index = 1 * e.target.dataset.index;
                if (station.barriers[index].required != characters.current.state) {
                    return;
                }
                // move character to the appropriate point
                characters.current.goTo(station.barriers[index].x, station.barriers[index].y, function() {
                    characters.current.destination.vecY = station.barriers[index].deltaY < 0 ? -1 : 1;
                    characters.current.orientation(0, -1);
                    characters.current.waitingForTicket = index+1;
                    characters.current.updateTickets();
                    document.getElementById("cbTickets").checked = true;
                });
                return;
            }
            
            
            /** By default click on the background. **/
            
            // no selected character --> return
            if (characters.current == null || (characters.current.state != 1 && characters.current.state != 3))
                return;
            // sets character direction
            var destX = (e.clientX + scrollX) / WIDTH * 100;
            var destY = (e.clientY + scrollY) * (100 / WIDTH);
            // check if the character is authorized to go there
            if (station.isInZoneOK(characters.current, destX, destY)) {            
                characters.current.goTo(destX, destY, null);
            }
        
        });
        
        /** 
         *  Displays the scenery of the station whose name is given in parameter.
         *  @param  Station     st      The station to display
         */
        this.display = function(st) {
            // chage current class attributes 
            this.station = st;
            this.barrier = new Barrier(network, st.name, fares);
            this.escalators = {};
            // html code
            let html = "<header></header>";
            let htmlH1 = st.jp + " 駅<br><span>" + st.name + "</span>"; 
            let htmlPanels = "";
            let j = 0;
            for (let l in st.lines) {
                let line = network.lines[l];
                let top = 12.5 + j*25;
                j++;
                let alone = (st.lines[l].number == 1 || st.lines[l].number == line.stations.length);
                html += "<section" + (alone ? " class='single'" : "") + "></section>";
                // building of line squares in the main panel 
                htmlH1 = "<div class='line' style='border-color: " + line.color + ";'>"
                    + line.jp + "<div>" + line.abbr + "<br>" 
                    + (st.lines[l].number <= 9 ? "0" : "") + st.lines[l].number 
                    + "</div></div>" + htmlH1;
                htmlPanels += "<div class='panel' style='top: " + top + "vw;'>";
                // panels over the escalators --> terminus (dec)
                if (line.stations[0].name != st.name) {
                    htmlPanels += "<h2 style='color: " + line.color + ";'>"
                        // arrow
                        + "<div class='arrow'>&#10132;</div>"
                        // logo
                        + "<img class='logo' src='./images/picto-train.png' style='background-color: " + line.color + ";'>"
                        // jp
                        + line.jp + " " + line.stations[0].jp + "<br>"
                        // english
                        + "<span>For " + l + " Line, " + line.stations[0].name 
                        + "</span></h2>";
                    // escalator 
                    this.escalators['dec'+l] = { line: line.name, dir: -1, x: (alone ? 52.75 : 27.65), y: top+9.5 }; 
                    html += "<div class='escalator dec' style='top: " + (top+7) + "vw; z-index: " + (top + 10 |0) + "0;' data-id='dec" + l + "'><div class='up'></div><div class='down'></div></div><div class='overlay' style='top: " + (top+7+9) + "vw; z-index: " + ((top+22.5)*10 | 0) + ";'></div>";
                }
                // panels over the escalators --> terminus (inc)
                if (line.stations[line.stations.length-1].name != st.name) {
                    htmlPanels += "<h2 style='color: " + line.color + ";'>"
                        // arrow
                        + "<div class='arrow'>&#10132;</div>"
                        // logo
                        + "<img class='logo' src='./images/picto-train.png' style='background-color: " + line.color + ";'>"
                        // jp
                        + line.jp + " " + line.stations[line.stations.length-1].jp + "<br>"
                        // english
                        + "<span>For " + l + " Line, " + line.stations[line.stations.length-1].name 
                        + "</span></h2>";
                    // escalator
                    this.escalators['inc'+l] = { line: line.name, dir: 1, x: (alone ? 52.75 : 75.5), y: top+9.5 }; 
                    html += "<div class='escalator inc' style='top: " + (top+7) + "vw; z-index: " + (top+10 | 0) + "0;' data-id='inc" + l + "'><div class='up'></div><div class='down'></div></div><div class='overlay' style='top: " + (top+7+9) + "vw; z-index: " + ((top+22.5)*10 | 0) + ";'></div>";
                }
                htmlPanels += "</div>";
            }
            htmlPanels = "<div class='panel' style='top: " + (23+25*j)  + "vw;'><h1><img src='./images/picto-train.png' class='logo'>" + htmlH1 + "</h1></div>" + htmlPanels;
            // footer: 6 barriers, 4 ticket vending machines, 2 fare adjustment machines 
            html += "<footer>";
            [0,1,2,3,4,5].forEach(n => html += "<div class='barrier' data-index='" + n + "'></div>");
            [0,1,2,3].forEach(n => html += "<div class='TVM' data-index='" + n + "'></div>");    
            [0,1].forEach(n => html += "<div class='FAM' data-index='" + n + "'></div>");    
            html += "</footer>" + htmlPanels;

            // assignmet of computed HTML code to the 
            this.element.innerHTML = html + 
                "<label id='btnAddCharacter' class='sprite" + (Math.random()*8 | 0) + "'></label>" + 
                "<label id='btnExit'></label>" +
                "<label id='btnTickets' for='cbTickets'></label>";

            // update scrolling for panels
            panels = document.querySelectorAll("main .panel");
            this.revalidatePanels();

            // shows the station
            this.element.previousElementSibling.checked = true;
            
            // update station dimensions 
            HEIGHT = this.element.clientHeight;
            WIDTH = this.element.clientWidth;
            BOTTOM = HEIGHT * 100 / WIDTH;
            
            // add the characters into the station 
            characters.displayInStation(this.station);
            
            
            let zonesOK = [
                // bottom line
                { t: BOTTOM - 14, l: 1, h: 13, w: 98 },
                // line after barriers
                { t: BOTTOM - 35.5, l: 4, h: 6.5, w: 92 },
                // intermediate
                { t: BOTTOM - 46.5, l: 17, h: 11.5, w: 79 },                
                // bottom of station
                { t: BOTTOM - 51.5, l: 4, h: 6, w: 92 },
                // first line
                { t: 10, l: 4, h: 9, w: 92 }
            ];

            let nbLines = Object.keys(this.station.lines).length;
            let i = 0;
            let firstOrLast;
            for (let l in this.station.lines) {
                // si plusieurs entrées à la ligne : 
                firstOrLast = this.station.lines[l].number == 1 || this.station.lines[l].number == network.lines[l].stations.length;
                zonesOK.push(                            
                        // in between
                        { t: 11+25*i, l: 4, h: 11, w: 92 }
                    );
                i++;
            }
            // vertical lines
            if (!firstOrLast) {
                zonesOK.push(
                    { t: 10, l: 4, h: 6+25*nbLines, w: 6.5 },
                    { t: 10, l: 38.5, h: 6+25*nbLines, w: 20 },
                    { t: 10, l: 87, h: 6+25*nbLines, w: 9 }
                );
            }
            else {
                zonesOK.push(
                    { t: 10, l: 4, h: 6+25*nbLines, w: 32 },
                    { t: 10, l: 61, h: 6+25*nbLines, w: 35 }
                );
            }
            
            // debug (un peu sale)
            let debug = document.createElement("div");
            debug.innerHTML = zonesOK.map(z => "<div class='debug' style='width: " + z.w + "vw; height: " + z.h + "vw; left: " + z.l + "vw; top: " + z.t + "vw;'></div>").join("");
            //this.element.appendChild(debug);

            this.zonesOK = zonesOK;
            
            /** Set of barriers (as GUI elements) **/
            this.barriers = [
                { required: 3, x: 27.9, y: BOTTOM - 29, deltaY: +18, inUse: false },
                { required: 3, x: 36.4, y: BOTTOM - 29, deltaY: +18, inUse: false },
                { required: 3, x: 45.9, y: BOTTOM - 29, deltaY: +18, inUse: false },
                { required: 1, x: 55.4, y: BOTTOM - 13.5, deltaY: -17, inUse: false },
                { required: 1, x: 64.4, y: BOTTOM - 13.5, deltaY: -17, inUse: false },
                { required: 1, x: 73.9, y: BOTTOM - 13.5, deltaY: -17, inUse: false }
            ];
            /** Set of machines (as GUI elements) **/
            this.machines = { 
                "TVM": [{ required: 1, x: 4.9,  y: BOTTOM - 13.5, inUse: false },
                        { required: 1, x: 84.4, y: BOTTOM - 13.5, inUse: false },
                        { required: 1, x: 89.9, y: BOTTOM - 13.5, inUse: false },
                        { required: 1, x: 95.9, y: BOTTOM - 13.5, inUse: false }], 
                "FAM": [{ required: 3, x: 6.4, y: BOTTOM - 35, inUse: false },
                        { required: 3, x: 11.9, y: BOTTOM - 35, inUse: false }]
            };
            
        }
        this.display(initialStation);
        
        
        /** 
         *  Checks if the current character is authorized to go in the requested zone 
         *  @param  Character   char    the current character
         *  @param  int         x       the x coordinate
         *  @param  int         y       the y coordinate
         */
        this.isInZoneOK = function(char, x, y) {
            //char.state = 2;
            // character in the bottom of the scene
            if (char.state == 1) {
                return isInside(x, y, this.zonesOK[0]);
            }
            // character inside the station
            if (char.state == 3) {
                return this.zonesOK.some((z, i) => i > 0 && isInside(x, y, z));   
            }
            return true;
        }
        /**
         *  Checks if a position (x,y) is inside a zone. 
         *  @param  int     x       the x coordinate
         *  @param  int     y       the y coordinate
         *  @param  Object  z       the considered zone defined by t(op), l(eft), w(idth), h(eight)
         */
        function isInside(x, y, zone) {
            return (x >= zone.l && x <= zone.l + zone.w && y >= zone.t && y <= zone.t + zone.h); 
        }
        
    }    
    
    
    
    /***************************************************************
                        Network map object
    ***************************************************************/    
    
    /**
     *  GUI for the map display and interaction.
     */
    function MapGUI() {
     
        /** Element associated to the map */
        this.element = document.getElementById("map");
     
        //** Previous radio button that was selected */
        this.previous = null;
        
        /** Events: clicks on the map to change station */
        this.element.addEventListener("click", function(e) {
            
            e.stopPropagation();
            e.preventDefault();
            
            if (e.target.classList.contains("station")) {
                if (characters.current) {
                    return;   
                }
                let name = e.target.dataset.name;
                let st = network.getStationByName(name);
                station.display(st);
                map.displayNetworkMap(st);
                document.querySelector("main > footer").scrollIntoView();
                return;
            }
        });
    
        
        /**
         *  Closes the map window and restores the opener.
         */
        this.close = function() {
            if (this.previous != null) {
                this.previous.checked = true;
                this.previous = null;
                if (document.getElementById("radStation").checked) {
                    if (characters.current) {
                        characters.current.element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });   
                    }
                    else {
                        document.querySelector("main > footer").scrollIntoView();   
                    }
                }
            }
            else {
                this.previous = document.querySelector("input[name=rad0]:checked");
                document.getElementById("radMap").checked = true;
                document.querySelector(".station.this").scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
            }
        }
        
        
        /**
         *  Displays the network map, with fares and current station identified
         *  @param  Station     st      Object representing the current station
         *                              from which fares are computed. 
         */
        this.displayNetworkMap = function(st) {

            // used to compute distances in the 
            let barrier = station.barrier;

            let allLines = Object.keys(network.lines);

            let longestLine = allLines.reduce(function(acc, elt) { 
                if (network.lines[elt].stations.length >= network.lines[acc].stations.length) {
                    return elt;
                }
                return acc;
            }, allLines[0]);

            // assuming there is a single central connexion point between lines
            let central = Object.values(network.stations).find(function(e) {
                 return Object.values(e.lines).length == allLines.length;
            });

            // sort lines to start with line in which the central station is the longest
            allLines.sort(function(l1, l2) {
                return central.lines[l2].number -  central.lines[l1].number;    
            });

            // computes the HTML code for the different lines
            let html = "";
            for (let line of allLines) {
                html += "<div class='line' style='background-color: " + network.lines[line].color + "; color: " + 
                    network.lines[line].color + ";' data-abbr='" + network.lines[line].abbr + 
                    "'><div class='lineinfo' style='background-color: " + network.lines[line].color + 
                    ";' data-name='" + line + "'>" + network.lines[line].jp + "</div>";
                let i = central.lines[longestLine].number - central.lines[line].number;
                html += "<div class='station invisible'><div class='price'></div></div>".repeat(i);
                i += network.lines[line].stations.length;
                network.lines[line].stations.forEach(function(e) {
                    let dist = barrier.getShortestDistanceTo(e.name);
                    let adult = barrier.computeFare(false, dist);
                    let child = barrier.computeFare(true, dist);
                    html += "<div class='station" + (e.name == st.name ? ' this' : '') + "' data-jp='" + e.jp + 
                        "' data-number='" + network.lines[line].abbr + (e.number < 10 ? '0' : '') + e.number + 
                        "' data-name='" + e.name + "'>" + e.name;
                    if (e.name != st.name) { 
                        html += "<div class='price' data-adult='" + adult + "' data-child='" + child + "'></div>";
                    }
                    html += "</div>";
                });
                html += "</div>";
            }
            
            // update element content 
            this.element.querySelector("div").innerHTML = html;
        }
        
    }

    
    
    /***************************************************************
                        Network train animation
    ***************************************************************/
    
    /**
     *  GUI for the travel display and interaction.
     */
    function TravelGUI() {
            
        // Associated HTML element 
        this.element = document.querySelector("nav");
        
        // Current Timeout
        let currentTO = null;
        
        // Current station, line, direction 
        this.station = null;
        this.line = null;
        this.direction = 0;
        
        
        // Events: ending a travel by clicking on the wall 
        document.querySelector("nav .wall").addEventListener("click", function() {
            clearTimeout(currentTO);
            travel.element.classList.remove("animate");
            travel.element.classList.remove("dec");
            travel.element.classList.remove("inc");
            station.display(travel.station);
            characters.current.exitsTrain(travel.station, travel.line, travel.direction);
            characters.current.updateTickets();
            characters.current.element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
            map.displayNetworkMap(travel.station);
        });
    
        
        /**
         *  Starts a travel: first sets the scenery, then starts the animation.
         *  @param  String  station     the name of the station
         *  @param  String  line        the name of the line
         *  @param  int     dir         the direction >0 (ascending) or <0 (descending) 
         *                                  w.r.t. the station number on the considered line.
         */
        this.startTravel = function(st, line, dir) {

            // clear previous travel data
            this.element.classList.remove("animate");
            this.element.classList.remove("dec");
            this.element.classList.remove("inc");

            line = network.lines[line];
            if (!line) {
                console.log("line does not exist");
                return;
            }

            st = network.getStationByName(st);
            if (!st) {
                console.log("station does not exist");
                return;
            }
            
            // setup the main parameters of the travel
            this.station = st;
            this.line = line;
            this.direction = dir;
        
            // sets up the scenery: wall panels and line plan
            document.querySelector("nav .top").innerHTML = getCodeForPlan(line);
            changeWallPanels(st, line, dir);
            // assign ads in the train 
            document.getElementById("adLeft").src = "./images/ads/tokyo-metro-manner-" + (Math.random() * 24 | 0) + ".gif";
            document.getElementById("adRight").src = "./images/ads/tokyo-metro-manner-" + (Math.random() * 24 | 0) + ".gif";
            
            // runs the train
            this.runTrain();
            // shows the scene
            this.element.previousElementSibling.checked = true;
        }
    
        
        /**
         *  Starts the animation, assuming that this.station, this.line and this.direction are set.
         */
        this.runTrain = function() {
        
            // clear previous travel data
            this.element.classList.remove("animate");
            this.element.classList.remove("dec");
            this.element.classList.remove("inc");

            // test if needed to change direction
            if (! existsNextStation(this.station, this.line, this.direction)) {
                this.direction = -1 * this.direction;   
            }
            // if no next station, return (should not happen - otherwise we are at the only station of the line)
            if (! existsNextStation(this.station, this.line, this.direction)) {
                console.log("Current station has no next station (weird)");
                return;   
            }

            // update current station on track plan
            for (let st of this.line.stations) {
                let spot = document.querySelector("nav .plan > div:nth-child(" + st.number + ")");
                spot.classList.remove("current");
                spot.classList.remove("visited");
                if (this.direction > 0 && st.number <= this.station.lines[this.line.name].number) {
                    spot.classList.add("visited");
                }
                else if (this.direction < 0 && st.number >= this.station.lines[this.line.name].number) {
                    spot.classList.add("visited");   
                }
            }

            // computes and displays the code of the announce
            let next = this.line.stations[this.station.lines[this.line.name].number - 1 + this.direction];
            document.querySelector("nav .announce .text").innerHTML = 
                "<span>次 は " + next.jp + " です。<br><br>Next station: " + next.name + "</span>";
        
            // starts the animation by setting the direction, the animation, and highlighting the next point.
            setTimeout(function() {
                this.element.classList.add(this.direction > 0 ? "inc" : "dec");
                this.element.classList.add("animate");
                let nbNext = this.station.lines[this.line.name].number + this.direction;
                document.querySelector("nav .plan > div:nth-child(" + nbNext + ")").classList.add("current");
            }.bind(this), 1000);
            
            // sets timer to change the station scenery when running through a dark zone
            currentTO = setTimeout(this.arriveAtNextStation.bind(this), 7000);
        }
    

        /**
         *  Changes the scenery between two stations 
         */
        this.arriveAtNextStation = function() {
            // compute next station
            let next = this.line.stations[this.station.lines[this.line.name].number - 1 + this.direction];
            next = network.getStationByName(next.name);
            // assign to current station
            this.station = next;
            // updates scenery 
            changeWallPanels(next, this.line, this.direction);
            currentTO = setTimeout(this.runTrain.bind(this), 8000); 
        }
    
    
        /**
         *  Checks if there is a next station in the considered direction. (private)
         *  @return     boolean     true if a next station exists, false otherwise. 
         */
        function existsNextStation(st, line, dir) {
            return null != line.stations[st.lines[line.name].number - 1 + dir];   
        }
    

        /**
         *  Changes the wall decoration to make it match a given station (private)
         *  @param  Station  st     current station
         *  @param  Line     line   current line
         *  @param  int      dir    direction
         */
        function changeWallPanels(st, line, dir) {
            document.querySelector("nav .wall").innerHTML =
                getCodeForStationPanel(st, line, dir).repeat(3) +
                getCodeForExit(st, line).repeat(3);
        }

        
        /**
         *  Computes the HTML code representing station panels (private)
         *  @param  Station  st     current station
         *  @param  Line     line   current line
         *  @param  int      dir    direction
         */
        function getCodeForStationPanel(st, line, dir) {
            let n = st.lines[line.name].number < 10 ? "0" : "";
            let np = st.lines[line.name].number-1 < 10 ? "0" : "";
            let nn = st.lines[line.name].number+1 < 10 ? "0" : "";
            let next = network.getStationForLineAndNumber(line.name, st.lines[line.name].number + 1);
            let previous = network.getStationForLineAndNumber(line.name, st.lines[line.name].number - 1);

            let incOrDec = next == null ? "dec" : 
                           previous == null ? "inc" : 
                           dir > 0 ? "inc" : "dec";

            return "<div class='station " + incOrDec + "'>" +
                "<div class='line' data-line='" + line.abbr + "' data-number='" + n + st.lines[line.name].number + "' style='border-color: " + line.color + ";'></div>" +
                "<div class='station-arrow' style='background-color: " + line.color + ";'>" +
                    "<div class='arrow-head' style='border-left-color: " + line.color + "; border-right-color: " + line.color + ";'></div>" +
                    (next ? ("<div class='next' data-number='" + line.abbr + nn + next.lines[line.name].number + "'>" + next.jp + "<br>" + next.name + "</div>") : "") +
                    (previous ? ("<div class='previous' data-number='" + line.abbr + np + previous.lines[line.name].number + "'>" + previous.jp + "<br>" + previous.name + "</div>") : "") +
                "</div>" + 
                st.jp + "<br>" + st.name + "</div>";

        }
        /**
         *  Computes the code for the exit panels. Direction change depending on the parity of station number (private)
         *  @param  Station  st     current station
         *  @param  Line     line   current line
         */
        function getCodeForExit(st, line) {
            return "<div class='exit exit-" + 
                (st.lines[line.name].number % 2 == 0 ? "left" : "right") + "'>出口<br>exit</span></div>";
        }
        /**
         *  Computes the HTML code for the line plan to be display above the train doors. 
         *  @param  Line     line   current line
         */
        function getCodeForPlan(line) {
            let html = "<div class='plan' data-jp='" + line.jp + "' data-en='" + line.name + "' style='--line-color: " + line.color + "; border-color: " + line.color + "; color: " + line.color + ";'>";
            for (let st of line.stations) {
                html += "<div data-number='" + line.abbr + (st.number <= 9 ? '0' : '') + st.number + "'><span>" + st.jp + "</span><span>" + st.name + "</span></div>";   
            }
            return html + "</div>";
        }
    }
    
    
    
    /***************************************************************
                        Network map object
    ***************************************************************/    

    /**
     *  GUI for the ticket machines display and interaction.
     */
    function TicketMachineGUI() {
           
        // HTML element associated to the ticket machine
        this.element = document.querySelector("aside");
        
        // Ticket vending / Fare adjustment 
        this.vending = true;
        
        // Current state
        this.state = 0;
        
        // Selected fare 
        this.fare = {adult: 0, child: 0};
        
        // Tickets to buy
        this.tickets = { adult: 0, child: 0 };
        
        // inserted ticket for fare adjstment
        this.ticket = null;
        
        
        /**
         *  Computes the child fare based on the adult fare.
         *  @param  int     adultFare       the fare for an adult
         *  @return int                     the corresponding child fare
         */
        this.computeChildFare = function(adultFare) {
            adultFare /= 2;
            return (adultFare % 10 == 5) ? adultFare + 5 : adultFare;
        }
        
        /** 
          * Resets to the initial state.
          */
        this.reset = function() {
            this.state = this.vending ? "TV0" : "FA0";
            this.tickets.adult = 0; 
            this.tickets.child = 0; 
            this.ticket = null;
            this.fare.adult = 0;
            this.fare.child = 0;
            this.element.classList.remove("out");
            this.element.classList.remove("payment");
            this.updateDisplay();
        }
        
        
        /** 
         *  Initializes and displays a ticket vending machine interface
         */
        this.displayTicketVending = function() {
            document.querySelector("aside .machine .title").innerHTML = "券売機 - <span>Tickets</span>";
            this.vending = true;
            this.reset();
            this.element.classList.remove("fareAdjustment");
            this.updateDisplay();
            document.getElementById("cbJPEN").checked = false;
            this.element.previousElementSibling.checked = true;
        }
        
        /** 
         *  Initializes and displays a fare adjustment machine interface
         */
        this.displayFareAdjustment = function() {
            document.querySelector("aside .machine .title").innerHTML = "運賃調整 - <span>Fare adjustment</span>";
            this.vending = false;
            this.element.classList.add("fareAdjustment");
            this.reset();
            document.getElementById("cbJPEN").checked = false;
            this.updateDisplay();
            this.element.previousElementSibling.checked = true;
        }

        /** 
         *  Produces/ejects the tickets, based on the this.tickets attribute content. 
         */
        this.ejectTickets = function() {
            // remove the payment state
            this.element.classList.remove("payment");
            
            // add tickets out
            let html = ""
            if (this.vending) {
                let total=this.tickets.child+this.tickets.adult;
                for (let i=0; i < total; i++) {
                    html += "<div class='ticket' style='left: " + (i/total * 8 + 1) + "vw;'></div>";
                }
            }
            else {
                html = "<div class='ticket' style='left: 4vw;'></div>";   
                // adjust fare on ticket 
                let total0 = (this.ticket.isChild() ? this.fare.child : this.fare.adult) - this.ticket.getAmount();
                this.ticket.adjustFare(total0);                
            }
            document.querySelector("aside .tickets").innerHTML = html;
            // reset buying
            this.state = this.vending ? "TV3" : "FA3";
            // add the .out class to prevent closing 
            this.element.classList.add("out");
            this.updateDisplay();
        }
        
        
        /** 
         *  Gives the ticket back to the user because it could not be adjusted. 
         */
        this.giveBackTicket = function() {
            document.querySelector("aside .tickets").innerHTML = "<div class='ticket' style='left: 4vw;'></div>";        
            // add the .out class to prevent closing 
            this.element.classList.add("out");
        }
        
        
        
        /** 
         *  Triggered when the user takes the tickets by clicking on them.
         */
        this.takeTickets = function() {
            // empties ticket content
            document.querySelector("aside .tickets").innerHTML = "";
            // if tickets vending 
            if (this.state == "TV3") {
                for (let i=0; i < this.tickets.adult; i++) {
                    characters.current.addTicket(new Ticket(false, this.fare.adult)); 
                }
                for (let i=0; i < this.tickets.child; i++) {
                    characters.current.addTicket(new Ticket(true, this.fare.child));  
                }
            }
            // if fare adjustment
            else {
                characters.current.addTicket(this.ticket);
            }
            characters.current.updateTickets();
            this.reset();
            this.updateDisplay();
        }
        
        
        /**
         *  Triggered when cancel button is pressed.
         */
        this.cancelPressed = function() {
            // case of the ticket vending --> if not waiting for ticket taking cancels transaction.
            if (this.vending && !this.element.classList.contains("out")) {
                this.reset();
                this.updateDisplay();
            }
            if (!this.vending && this.ticket) {
                document.querySelector(".screen .right").innerHTML = 
                    "<p lang='en'>Please take back your ticket.</p>"
                    + "<p lang='jp'>チケットを取り戻してください。</p>";
                this.giveBackTicket();
            }   
        }
        
        /** 
         *  Triggered when a button to select adult/child is pressed
         *  @param  int     adult   number of adults to add
         *  &param  int     child   number of children to add
         */
        this.addAdultChild = function(adult, child) {
            if (this.state == "TV0" || this.state == "TV1") {
                this.state = "TV1";
                this.tickets.adult += adult;
                this.tickets.child += child;
                this.updateDisplay();
            }
        }
        
        
        /**
         *  Triggered when a fare is selected on the interface.
         *  @param  int     amount      the selected fare value.
         */
        this.selectFare = function(amount) {
            if (this.state == "TV1") {
                this.fare.adult = amount;
                this.fare.child = this.computeChildFare(amount);    
                this.state = "TV2";
                this.element.classList.add("payment");
            }
            else if (this.state == "FA1") {
                if (this.ticket.isChild()) {
                    this.fare.child = amount;
                    this.fare.adult = 0;
                    this.tickets.child = 1;
                    this.tickets.adult = 0;
                }
                else {
                    this.fare.adult = amount;
                    this.fare.child = 0;
                    this.tickets.adult = 1;
                    this.tickets.child = 0;
                }
                this.state = "FA2";
                this.element.classList.add("payment");
            }
            this.updateDisplay();
        }
        
        
        /**
         *  Triggered when the customer pays.
         *  @param  int     amount      the amount payed by the customer. 
         */
        this.pay = function(amount) {
            let total = document.querySelector(".payment [data-total]");
            total.dataset.total = total.dataset.total - 1*amount;
            if (total.dataset.total <= 0) {
                total.dataset.total = 0;
                this.ejectTickets();
            }
        }
        
        
        /**
         *  Triggered when the customer inserts a ticket for fare adjustment
         *  @param  Ticket  t   the ticket inserted by the customer.
         */
        this.insertTicket = function(t) {
            this.ticket = t;
            // if ticket is not in the appropriate state // --> give it back to the user.
            if (!t.getEntryStation()) {
                document.querySelector(".screen .right").innerHTML = 
                    "<p lang='en'>No possible fare adjustment.<br><br>Please take back your ticket.</p>"
                    + "<p lang='jp'>可能な運賃調整はありません<br><br>チケットを取り戻してください。</p>";
                this.giveBackTicket();
                return;
            }
            this.element.classList.add("out");
            this.state = "FA1";
            this.updateDisplay();
        }
        
        
        // updates the display (right part of the screen) w.r.t. the current state
        this.updateDisplay = function() {
            let html = "", suffix1, suffix2;
            switch (this.state) {
                case "TV0": 
                    html = "<p lang='en'>Welcome to the Sapporo Subway<br><br>"
                        +       "<img src='./images/st-logo.png'><br><br><br><br>Please select the travelers</p>"
                        + "<p lang='jp'>札幌地下鉄へようこそ<br><br><img src='./images/st-logo.png'><br><br>"
                        +       "<br><br>旅行者を選択してください</p>";
                    break;
                case "TV1":
                    suffix1 = this.tickets.adult > 1 ? "s" : "";
                    suffix2 = this.tickets.child > 1 ? "ren" : "";
                    html = "<p lang='en'>Adjust tickets, and then choose fare amount below</p>"
                        + "<p lang='jp'>チケットを調整してから、以下の運賃を選択します。</p>"
                        + "<p>" + this.tickets.adult + " <span lang='en'>adult" + suffix1 + "</span><span lang='jp'>大人</span> - "
                                + this.tickets.child + " <span lang='en'>child" + suffix2 + "</span><span lang='jp'>子供</span></p>"
                        + "<div class='fares'>";
                    for (let f of Object.values(fares)) {
                        html += "<label data-fare='" + f + "' data-child='" + this.computeChildFare(f) + "'></label>";   
                    }
                    html += "</div>";
                    break;
                case "TV2": 
                    let total = this.fare.child * this.tickets.child + this.fare.adult * this.tickets.adult;
                    suffix1 = this.tickets.adult > 1 ? "s" : "";
                    suffix2 = this.tickets.child > 1 ? "ren" : "";
                    html = "<p>" 
                        + this.tickets.adult + " <span lang='en'>adult" + suffix1 + "</span><span lang='jp'>大人</span> x " + this.fare.adult + " + "
                        + this.tickets.child + " <span lang='en'>child" + suffix2 + "</span><span lang='jp'>子供</span> x " + this.fare.child + "</p>"
                        + "<div class='msgPayment' data-total='" + total + "'><span lang='jp'>お支払いに進んでください。</span>" 
                        + "<span lang='en'>Please proceed to payment</span></div>";
                    break;
                case "TV3": 
                    html = "<p lang='en'>Please take your tickets.<br><br><br>Have a nice trip!</p>"
                        + "<p lang='jp'>チケットを受け取ってください。<br><br><br>良い旅を。</p>";
                    break;
                case "FA0":
                    html = "<p lang='en'>Welcome to the Sapporo Subway<br><br>" 
                        +       "<img src='./images/st-logo.png'><br><br><br><br>Please insert a ticket to adjust its fare.</p>"
                        + "<p lang='jp'>札幌地下鉄へようこそ<br><br><img src='./images/st-logo.png'><br><br>" 
                        +       "<br><br>運賃を調整するためにチケットを挿入してください。</p>";
                    break;
                case "FA1":
                    // compute possible fares
                    let possibleFares = Object.values(fares).map(function(f) {
                        if (ticketMachine.ticket.isChild()) {
                            f = f / 2;
                            if (f % 10 == 5) {
                                f += 5;   
                            }
                        }
                        return f;
                    }).filter(function(f) {
                        return f > ticketMachine.ticket.getAmount();
                    });
                    // no possible fare (ticket is already fully "loaded")
                    if (possibleFares.length == 0) {
                        html = "<p lang='en'>No possible fare adjustment.<br><br>Please take back your ticket.</p>"
                                + "<p lang='jp'>可能な運賃調整はありません<br><br>チケットを取り戻してください。</p>";
                        this.giveBackTicket();
                    }
                    // possible fare adjustments
                    else {
                        html = "<p lang='en'>Adjust fare amount below</p>"
                            + "<p lang='jp'>以下の運賃を調整します。</p>"
                            + "<div class='fares'>";
                        possibleFares.forEach(function(f) {
                            html += "<label data-fare='" + f + "'></label>";   
                        });
                    }
                    html += "</div>";
                    break;
                 case "FA2": 
                    let total0 = (this.ticket.isChild() ? this.fare.child : this.fare.adult) - this.ticket.getAmount();
                    html = "<div class='msgPayment' data-total='" + total0 + "'><span lang='jp'>お支払いに進んでください。</span>" 
                        + "<span lang='en'>Please proceed to payment</span></div>";
                    break;
                case "FA3": 
                    html = "<p lang='en'>Please take your ticket.<br><br><br>Have a nice trip!</p>"
                        + "<p lang='jp'>チケットを受け取ってください。<br><br><br>良い旅を。</p>";
                    break;
               
            }
            document.querySelector(".screen .right").innerHTML = html;
        }
        
        /***** EVENTS: click on the screen **/
        this.element.addEventListener("click", function(e) {
            
            // closing
            if (e.target.classList.contains("btnClose")) {
                station.element.previousElementSibling.checked = true;   
                if (characters.current) {
                    characters.current.element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
                }
                else {
                    document.querySelector("main > footer").scrollIntoView();
                }
                return;
            }
            
            // cancelling current transaction
            if (e.target.id == "btnCancel" || e.target.parentElement.id == "btnCancel") {
                ticketMachine.cancelPressed();
                return;
            }
            
            // +1 adult/child
            if (e.target.id == "btnOneAdult" || e.target.parentElement.id == "btnOneAdult") {
                ticketMachine.addAdultChild(1, 0);
                return;
            }
            if (e.target.id == "btnOneChild" || e.target.parentElement.id == "btnOneChild") {
                ticketMachine.addAdultChild(0, 1);
                return;
            }
            
            // fare selection
            if (e.target.dataset.fare && e.target.tagName == "LABEL") {
                ticketMachine.selectFare(1*e.target.dataset.fare);    
                return;
            }
            
            // coins 
            if (ticketMachine.element.classList.contains("payment") && e.target.classList.contains("coins")) {
                do { 
                    var saisie = prompt("Insert money amount", 0);
                }
                while (!(Number.isInteger(1*saisie) && saisie > 0));
                ticketMachine.pay(saisie);
                return;
            }
            
            // taking tickets when they are given to the user 
            if (e.target.classList.contains("ticket") && ticketMachine.element.classList.contains("out")) {
                ticketMachine.takeTickets();
                return;
            }            
            // inserting tickets 
            if (e.target.classList.contains("tickets") && ticketMachine.state == "FA0") {
                if (characters.current && characters.current.tickets.length > 0) {
                    // shows the ticket selection window. 
                    characters.current.updateTickets();
                    document.getElementById("cbTickets").checked = true;   
                }
            }
        });

        /**
         *  Contactless payment, mousedown for > 2.5s on the surface.
         */
        let last;
        document.querySelector("aside .contactless").addEventListener("mousedown", function() {
            last = Date.now();
        });
        document.querySelector("aside .contactless").addEventListener("mouseup", function() {
            if (ticketMachine.element.classList.contains("payment") && Date.now() - last > 2500) {
                ticketMachine.pay(1*document.querySelector(".payment [data-total]").dataset.total);
            }
        });
        
    }
    
    
    
    
    
    
    /******************************************************
                  Initialization & main loop
    *******************************************************/

    // main loop
    function loop() {
        // pre-cache next frame
        requestAnimationFrame(loop);
        // if station is displayed
        if (station.element.previousElementSibling.checked) {
            // parallax effects on the panels when scrolling 
            station.revalidatePanels();
            // character movements (only for those in the station)
            characters.updateDisplay(station.station);
        }
    }
    
    
    /******************************************************** 
                Main that intialize the GUI 
    *********************************************************/
    // hide tickets
    document.getElementById("cbTickets").checked = false;
    // initializes network
    map.displayNetworkMap(station.station);
    // shows station scenery
    station.element.previousElementSibling.checked = true;
    // scroll to the bottom of the scene
    document.querySelector("main > footer").scrollIntoView();
    // runs main loop
    loop();
    
    
    /*
    document.addEventListener("mousemove", function(e) {
        var x = e.clientX + scrollX;
        var y = e.clientY + scrollY;
        for (var i=0; i < panels.length; i++) {
            var rect = rects[i];
            if (!(y < rect.top - 200 || y > rect.bottom + 200 || x < rect.left - 200 || x > rect.right + 200)) {
                if (!(y < rect.top || y > rect.bottom || x < rect.left || x > rect.right)) {
                    panels.item(i).style.display = "none";   
                }
                else {
                    var min = (y < rect.top) ? rect.top - y : 
                              (y > rect.bottom) ? y - rect.bottom :
                              (x < rect.left) ? rect.left - x : 
                              x - rect.right;
                    panels.item(i).style.opacity = min / 200; 
                    panels.item(i).style.display = "block";   
                }
                
            }
            else {
                panels.item(i).style.opacity = 1;
                panels.item(i).style.display = "block";   
            }
        }
        
    });
    */
    
});