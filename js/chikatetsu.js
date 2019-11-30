function Ticket(_child, _amount) {
 
    /** is this a child ticket? */
    this.child = _child;

    /** amount of money on the ticket for the trip */
    this.amount = (_amount > 0) ? _amount : 0;

    /** entry station */
    let entry = "should not be returned";

    /** state of the ticket: 0 - issued, 1 - entry set, 2 - invalid */
    const ISSUED = 0;
    const ENTERED = 1; 
    const INVALID = 2;
    let state = ISSUED;

    this.label = "";
    
    /**
     * Checks if the ticket is a child ticket. 
     * @return true if the ticket is for a child traveller.
     */
    this.isChild = function() {
        return this.child;
    }


    /**
     * Returns the entry station stored on the ticket.
     * @return The station name, or null if the ticket is invalid,
     *          or if the traveller didn't pass the barrier to enter.
     */
    this.getEntryStation = function() {
        return (state == ENTERED) ? entry : null;
    }


    /**
     * Sets the entry station on the ticket. Should be done only once. 
     * @param name the name of the station.
     * @return true if the station has been properly stored.
     */
    this.entering = function(name) {
        if (state == ISSUED && name != null && name.trim() != "") {
            entry = name;   
            state = ENTERED;
            this.date = new Date(Date.now());
            this.label = name;
            return true;
        }
        // this.invalidate();   
        return false;
    }


    /**
     * Signals the exiting of the station.
     */
    this.invalidate = function() {
        state = INVALID;
    }
    
        
    /**
     * Provides the amount of money that is on the ticket.
     * @return the balance of the ticket.
     */
    this.getAmount = function() {
        return this.amount;
    }


    /**
     * Increases the amount of the balance on the card. 
     * @param a the amount to add to the current balance.
     */
    this.adjustFare = function(a) {
        if (this.isValid() && a > 0) {
            this.amount += a;
        }
    }

    
    /**
     * Determines if the ticket is valid.
     * @return true if the ticket has not been invalidated. 
     */
    this.isValid = function() {
        return state != INVALID;
    }
}



function Barrier(_net, _st, _pr) {
 
    this.network = _net;

    this.station = _st;

    this.prices = _pr;

    /**
     * Use of the barrier to enter the subway, by inserting a ticket.
     * @return true if the ticket allowed to enter the station, false otherwise.
     */
    this.enter = function(t) {
        return t.getAmount() > 0 && t.entering(this.station);
    }

    /**
     * Use of the barrier to exit the subway by inserting a ticket.
     * @return true if the ticket allowed to exit the station, false otherwise. 
     */
    this.exit = function(t) {
        if (! t.isValid()) {
            return false;
        }
        if (t.getEntryStation() == null) {
            return false;
        }
        let distance = this.getShortestDistanceTo(t.getEntryStation());
        let fare = this.computeFare(t.isChild(), distance);
        if (t.getAmount() >= fare) {
            t.invalidate();
            return true;
        }
        return false;
    }

    /**
     * Computation of the fare depending on the adult/child ticket and the distance.
     * @param child indicates whether the fare concerns a child or not.
     * @param distance the distance used to compute the fare
     * @return the expected fare
     */
    this.computeFare = function(child, distance) {

        let fare = 0;
        for (let dist in this.prices) {
            if (distance >= 1*dist && fare < 1*this.prices[dist]) {
                fare = 1*this.prices[dist];
            }
        }

        // child pricing: ADULT / 2 rounded to the superior 10th
        if (child) {
            fare = fare / 2;
            if (fare % 10 == 5) {
                fare += 5;
            }
        }

        return fare;
    }


    /**
     * Returns the shortest distance from the current station to the source station. 
     * @param source the entry station for which the distance has to be computed.
     * @return a double representing the minimal distance, -1 if the station can not be reached.
     */
    this.getShortestDistanceTo = function(source) {
        if (source == null) {
            return -1;
        }
        if (this.station == source) {
            return 0.0;
        }
        // ordered list of pairs : < distance, path >
        // initial path, with 0.0 distance
        let paths = [{fst: 0.0, snd: [this.station]}];
        
        // while some paths remain to be explored
        while (paths.length > 0) {
            // extracts first element
            let firstElement = paths.shift();
            // if first element has reached destination --> victory
            if (firstElement.snd[0] == source) {
                return firstElement.fst;
            }
            // compute nexts steps from the current first element
            let nextSteps = [];
            // retrieve current station of the exploration
            let s = this.network.getStationByName(firstElement.snd[0]);
            // explore each line
            for (let line in s.lines) {
                // compute next and previous stations w.r.t. 
                let numberOnLine = s.lines[line].number;
                let prev = this.network.getStationForLineAndNumber(line, numberOnLine - 1);
                if (prev != null && firstElement.snd.indexOf(prev.name) < 0) {
                    let arl = [prev.name, ...firstElement.snd];
                    let newDist = firstElement.fst + Math.abs(s.lines[line].km - prev.lines[line].km);
                    nextSteps.push({fst: newDist, snd: arl});
                }
                let next = this.network.getStationForLineAndNumber(line, numberOnLine + 1);
                if (next != null && firstElement.snd.indexOf(next.name) < 0) {
                    let arl = [next.name, ...firstElement.snd];
                    let newDist = firstElement.fst + Math.abs(s.lines[line].km - next.lines[line].km);
                    nextSteps.push({fst: newDist, snd: arl});
                }
            }
            // insert pairs at their place
            for (let pa of nextSteps) {
                insertAtTheirPlace(pa, paths);
            }
        }
        return -1;
    }

    let insertAtTheirPlace = function(pa, current) {
        for (let i=0; i < current.length; i++) {
            if (current[i].fst > pa.fst) {
                current.splice(i, 0, pa);
                return;
            }
        }
        current.push(pa);
    }
    
}



function Network(initFunction) {

    /**
     *  Sapporo subway stations. 
     */
    this.lines = initFunction(); 
    
    /**
     *  Extraction of the stations 
     */
    this.stations = {};
    for (let line in this.lines) {
        for (let st in this.lines[line].stations) {
            let stObj = this.lines[line].stations[st];
            if (! this.stations[stObj.name]) {
                this.stations[stObj.name] = {};
                this.stations[stObj.name].name = stObj.name;
                this.stations[stObj.name].jp = stObj.jp;
                this.stations[stObj.name].lines = {};
            }
            this.stations[stObj.name].lines[line] = 
                { number: stObj.number, km: stObj.km };
        }
    }
    
    
    /**
     *  Returns the set of line names
     */
    this.getLines = function() {
        return Object.keys(this.lines);   
    }
    
    /**
     *  Returns the station based on the line and the number  
     */
    this.getStationForLineAndNumber = function(line, number) {
        if (this.lines[line].stations[1*number-1]) {
            return this.stations[this.lines[line].stations[1*number-1].name];
        }
        return null;
    }

    /**
     *  Returns the station based on its name
     */
    this.getStationByName = function(name) {
        return this.stations[name];
    }   
}
        



/**
 *  Describes the Sapporo Network
 */
function Sapporo() {
    return {
        "Namboku": { 
            abbr: "N", 
            name: "Namboku",
            color: "#008a00",
            jp: "南北線",
            stations: [
                { number: 1, name: "Asabu", jp: "麻生", km: 0 },
                { number: 2, name: "Kita-Sanjūyo-Jō", jp: "北34条", km: 1.0 },
                { number: 3, name: "Kita-Nijūyo-Jō", jp: "北24条", km: 2.2}, 
                { number: 4, name: "Kita-Jūhachi-Jō", jp: "北18条", km: 3.1}, 
                { number: 5, name: "Kita-Jūni-Jō", jp: "北12条", km: 3.9}, 
                { number: 6, name: "Sapporo", jp: "さっぽろ", km: 4.9}, 
                { number: 7, name: "Ōdōri", jp: "大通", km: 5.5}, 
                { number: 8, name: "Susukino", jp: "すすきの", km: 6.1}, 
                { number: 9, name: "Nakajima-Kōen", jp: "中島公園", km: 6.8}, 
                { number: 10, name: "Horohira-Bashi", jp: "幌平橋", km: 7.8}, 
                { number: 11, name: "Nakanoshima", jp: "中の島", km: 8.3}, 
                { number: 12, name: "Hiragishi", jp: "平岸", km: 9.0}, 
                { number: 13, name: "Minami-Hiragishi", jp: "南平岸", km: 10.1}, 
                { number: 14, name: "Sumikawa", jp: "澄川", km: 11.3}, 
                { number: 15, name: "Jieitai-Mae", jp: "自衛隊前", km: 12.6}, 
                { number: 16, name: "Makomanai", jp: "真駒内", km: 14.3} 
           ]
        },
        "Tōzai": { 
            abbr: "T", 
            name: "Tōzai",
            color: "#ffa900",
            jp: "東西線",
            stations: [
                 { number: 1, name: "Miyanosawa", jp: "宮の沢", km: 0}, 
                 { number: 2, name: "Hassamu-Minami", jp: "発寒南", km: 1.5}, 
                 { number: 3, name: "Kotoni", jp: "琴似", km: 2.8}, 
                 { number: 4, name: "Nijūyon-Ken", jp: "二十四軒", km: 3.7}, 
                 { number: 5, name: "Nishi-Nijūhatchōme", jp: "西28丁目", km: 4.9}, 
                 { number: 6, name: "Maruyama-Kōen", jp: "円山公園", km: 5.7}, 
                 { number: 7, name: "Nishi-Jūhatchōme", jp: "西18丁目", km: 6.6}, 
                 { number: 8, name: "Nishi-Jūitchōme", jp: "西11丁目", km: 7.5}, 
                 { number: 9, name: "Ōdōri", jp: "大通", km: 8.5}, 
                 { number: 10, name: "Bus Center-Mae", jp: "バスセンター前", km: 9.3}, 
                 { number: 11, name: "Kikusui", jp: "菊水", km: 10.4}, 
                 { number: 12, name: "Higashi-Sapporo", jp: "東札幌", km: 11.6}, 
                 { number: 13, name: "Shiroishi", jp: "白石", km: 12.7}, 
                 { number: 14, name: "Nangō-Nanachōme", jp: "南郷7丁目", km: 14.1}, 
                 { number: 15, name: "Nangō-Jūsanchōme", jp: "南郷13丁目", km: 15.2}, 
                 { number: 16, name: "Nangō-Jūhatchōme", jp: "南郷18丁目", km: 16.4}, 
                 { number: 17, name: "Ōyachi", jp: "大谷地", km: 17.9}, 
                 { number: 18, name: "Hibarigaoka", jp: "ひばりが丘", km: 18.9}, 
                 { number: 19, name: "Shin-Sapporo", jp: "新さっぽろ", km: 20.1 }
            ]
        },
        "Tōhō" : {
            abbr: "H",
            name: "Tōhō",
            color: "#0074ff",
            jp: "東豊線",
            stations: [
                 { number: 1, name: "Sakaemachi", jp: "栄町", km: 0 }, 
                 { number: 2, name: "Shindō-Higashi", jp: "新道東", km: 0.9}, 
                 { number: 3, name: "Motomachi", jp: "元町", km: 2.1}, 
                 { number: 4, name: "Kanjō-Dōri-Higashi", jp: "環状通東", km: 3.5}, 
                 { number: 5, name: "Higashi-Kuyakusho-Mae", jp: "東区役所前", km: 4.5}, 
                 { number: 6, name: "Kita-Jūsan-Jō-Higashi", jp: "北13条東", km: 5.4}, 
                 { number: 7, name: "Sapporo", jp: "さっぽろ", km: 6.7},
                 { number: 8, name: "Ōdōri", jp: "大通", km: 7.3}, 
                 { number: 9, name: "Hōsui-Susukino", jp: "豊水すすきの", km: 8.1}, 
                 { number: 10, name: "Gakuen-Mae", jp: "学園前", km: 9.5}, 
                 { number: 11, name: "Toyohira-Kōen", jp: "豊平公園", km: 10.4}, 
                 { number: 12, name: "Misono", jp: "美園", km: 11.4}, 
                 { number: 13, name: "Tsukisamu-Chūō", jp: "月寒中央", km: 12.6}, 
                 { number: 14, name: "Fukuzumi", jp: "福住", km: 13.6}
             ]
        }
    };
}
    


    
