import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, Platform, AlertController, LoadingController, ToastController } from 'ionic-angular';
import { Geolocation } from '@ionic-native/geolocation';
import { PlacesPage } from '../places/places';
import { PaymentMethodPage } from '../payment-method/payment-method';
import { UserPage } from "../user/user";
import { TrackingPage } from '../tracking/tracking';

import { PlaceService } from "../../services/place-service";
import { DealService } from "../../services/deal-service";
import { SettingService } from "../../services/setting-service";
import { DriverService } from "../../services/driver-service";
import { TripService } from "../../services/trip-service";
import { SHOW_VEHICLES_WITHIN, POSITION_INTERVAL, VEHICLE_LAST_ACTIVE_LIMIT , REQUEST_PENDING} from "../../services/constants";
import { DEAL_STATUS_PENDING, DEAL_STATUS_ACCEPTED } from "../../services/constants";
import 'rxjs/Rx';
import { AngularFireAuth } from "angularfire2/auth/auth";
import { AuthService } from "../../services/auth-service";
import * as firebase from 'firebase';
import { Observable } from 'rxjs/Observable';

import { Place } from "../../services/place";

import { TranslateService } from '@ngx-translate/core';

declare var google: any;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})

export class HomePage {
  // important variables
  base_fare: any = 25;
  per_km_fare: any = 10;

  mapId = Math.random() + 'map';
  mapHeight: number = 480;
  showModalBg: boolean = false;
  showVehicles: boolean = false;
  vehicles: any = [];
  currentVehicle: any;
  note: any = '';
  promocode: any = '';
  map: any;
  origin: any;
  destination: any;
  loading: any;
  distance: number = 0;
  duration: number = 0;
  currency: string;
  locality: any;
  paymentMethod: string = 'cash';
  activeDrivers: Array<any> = [];
  driverMarkers: Array<any> = [];
  driverTracking: any;
  locateDriver: any = false;
  drivers: any;

  mode_active:any="solo";
  
  user = {};
  transit_info: any = [];

  isTrackDriverEnabled = true;
  discount:any = 0;
  startLatLng: any;
  destLatLng: any;
  directionsService: any;
  directionsDisplay: any;
  bounds:any;
  cardNumber: any;
  // placesService: any;
  request_doc:any = {};

  distanceText:any = '';
  durationText:any = '';

  transit_first_line:any = null;

  destination_marker:any = new google.maps.Marker();
  ui_state: any;
  
  constructor(public nav: NavController, public platform: Platform, public alertCtrl: AlertController,
    public placeService: PlaceService, private geolocation: Geolocation, private chRef: ChangeDetectorRef,
    public loadingCtrl: LoadingController, public settingService: SettingService,
    public tripService: TripService, public driverService: DriverService, public afAuth: AngularFireAuth,
    public authService: AuthService, public translate: TranslateService,
    public dealService: DealService, private toastCtrl: ToastController) {
    // this.translate.setDefaultLang('en');
    this.origin = tripService.getOrigin();
    this.destination = tripService.getDestination();

    afAuth.authState.subscribe(authData => {
      if (authData) {
        this.user = authService.getUserData();
      }
    });
    
  }

  ionViewDidLoad() {
    // on view ready, start loading map
    this.tripService.getTrips().subscribe( trips => {
      console.log(trips);
      trips.forEach(trip => {
        console.log(trip.status);
        if(trip.status == 'waiting' || trip.status =='accepted' || trip.status == 'going'){
          this.isTrackDriverEnabled = false;
          this.nav.setRoot(TrackingPage, { tripId: trip.$key });
        }
      })
    })
    this.loadMap();
  }

  ionViewWillLeave() {
    // stop tracking driver
    clearInterval(this.driverTracking);
  }

  // get current payment method from service
  getPaymentMethod() {
    this.paymentMethod = this.tripService.getPaymentMethod()
    return this.paymentMethod;
  }
  choosePaymentMethod1(){
    let alert = this.alertCtrl.create({ message:'Profile -> Payments to add card'});
    alert.addInput({ type: 'radio', label: 'Cash', value: 'cash', checked: true });
    this.authService.getCardSetting().take(1).subscribe(snapshot => {
      if (snapshot) {
        this.cardNumber = snapshot.number;
        if (this.cardNumber != null || this.cardNumber != undefined)
          alert.addInput({ type: 'radio', label: 'Credit Card', value: 'card' });
      }
    });

    alert.addButton({ text: 'Cancel'});

    alert.addButton({
      text: 'Ok',
      handler: data => {
        console.log(data);
        this.tripService.setPaymentMethod(data);
      }
    });
    alert.present();
  }

  // toggle active vehicle
  chooseVehicle(index) {
    for (var i = 0; i < this.vehicles.length; i++) {
      this.vehicles[i].active = (i == index);
      // choose this vehicle type
      if (i == index) {
        this.tripService.setVehicle(this.vehicles[i]);
        this.currentVehicle = this.vehicles[i];
      }
    }
    // start tracking new driver type
    this.trackDrivers();
    this.toggleVehicles();
  }
  goProfilePage(){
    this.nav.push(UserPage,{ user: this.user });
  }

  // load map
  loadMap() {
    this.showLoading();

    // get current location
    return this.geolocation.getCurrentPosition().then((resp) => {

      if (this.origin) this.startLatLng = new google.maps.LatLng(this.origin.location.lat, this.origin.location.lng);
      else this.startLatLng = new google.maps.LatLng(resp.coords.latitude, resp.coords.longitude);

      let directionsDisplay;
      directionsDisplay = new google.maps.DirectionsRenderer();

      this.map = new google.maps.Map(document.getElementById(this.mapId), {
        zoom: 15,
        center: this.startLatLng,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false,
        zoomControl: false,
        streetViewControl: false,
      });
      
      this.bounds = new google.maps.LatLngBounds();
      this.directionsService = new google.maps.DirectionsService();
      let mapx = this.map;
      directionsDisplay.setMap(mapx);

      // find map center address
      let geocoder = new google.maps.Geocoder();
      geocoder.geocode({'latLng': this.map.getCenter()}, (results, status) => {
        if (status == google.maps.GeocoderStatus.OK) {
          if (!this.origin) {
            // set map center as origin
            this.origin = this.placeService.formatAddress(results[0]);
            this.tripService.setOrigin(this.origin.vicinity, this.origin.location.lat, this.origin.location.lng);
            this.setOrigin();
            this.chRef.detectChanges();
          } else {
            this.setOrigin();
          }

          // save locality
          let locality = this.placeService.setLocalityFromGeocoder(results);
          console.log('locality', locality);
          // load list vehicles
          this.settingService.getPrices().subscribe(snapshot => {
            console.log(snapshot);
            let obj = snapshot[locality] ? snapshot[locality] : snapshot.default;
            console.log(obj)
            this.currency = obj.currency;
            this.tripService.setCurrency(this.currency);

            // calculate price
            Object.keys(obj.vehicles).forEach(id => {
              obj.vehicles[id].id = id;
              this.vehicles.push(obj.vehicles[id]);
            });

            // calculate distance between origin adn destination
            if (this.destination) {
              this.placeService.getDirection(this.origin.location.lat, this.origin.location.lng, this.destination.location.lat,
                  this.destination.location.lng).subscribe(result => {
                    console.log(result);
                    if(result.routes.length != 0 ){
                      this.distance = result.routes[0].legs[0].distance.value;
                      
                      this.distanceText = result.routes[0].legs[0].distance.text;
                      this.durationText = result.routes[0].legs[0].duration.text;

                      for (let i = 0; i < this.vehicles.length; i++) {
                        this.vehicles[i].fee = this.distance * this.vehicles[i].price / 1000;
                        this.vehicles[i].fee = this.vehicles[i].fee.toFixed(2);
                      }
                    }else{
                      this.alertCtrl.create({
                        subTitle:'No Driver Found',
                        buttons: ['OK']
                      }).present();
                    }
              });
            }

            // set first device as default
            this.vehicles[0].active = true;
            this.currentVehicle = this.vehicles[0];
            console.log("Current Vehicle :"+JSON.stringify(this.currentVehicle));

            this.locality = locality;
            if(this.isTrackDriverEnabled)
              this.trackDrivers();
          });
        }
      });

      // add destination to map
      if (this.destination) {
        this.destLatLng = new google.maps.LatLng(this.destination.location.lat, this.destination.location.lng);
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(this.startLatLng);
        bounds.extend(this.destLatLng);
        
        mapx.fitBounds(bounds);
        var request = {
            origin: this.startLatLng,
            destination: this.destLatLng,
            travelMode: google.maps.TravelMode.DRIVING
        };
        this.directionsService.route(request, function (response, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                console.log(response);
                directionsDisplay.setDirections(response);
                directionsDisplay.setMap(mapx);
            } else {
                console.log("error");
            }
        });
      }
      this.hideLoading();
    }).catch((error) => {
      console.log('Error getting location', error);
    });
  }
  showPromoPopup(){
    let prompt = this.alertCtrl.create({
      title: 'Enter Promo code',
      message: "",
      inputs: [
        {
          name: 'promocode',
          placeholder: 'Enter Promo Code'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'Apply',
          handler: data => {
            console.log(data.promocode);
            //verifying promocode
            firebase.database().ref('promocodes').orderByChild("code").equalTo(data.promocode).once('value', promocodes => {
              console.log(promocodes.val());
              let tmp:any = [];
              promocodes.forEach( promo => {
                tmp.push({ key: promo.key, ...promo.val()})
                return false;
              })
              tmp = tmp[0];
              console.log(tmp)
              if(promocodes.val() != null || promocodes.val() != undefined){
                this.promocode = tmp.code;
                this.discount = tmp.discount;
                this.tripService.setPromo(tmp.code);
                this.tripService.setDiscount(tmp.discount);
                console.log('promo applied',tmp.code, tmp.discount);
              }
            }, err=> console.log(err));
          }
        }
      ]
    });
    prompt.present();
  }


  // Show note popup when click to 'Notes to user'
  showNotePopup() {
    let prompt = this.alertCtrl.create({
      title: 'Notes to user',
      message: "",
      inputs: [
        {
          name: 'note',
          placeholder: 'Note'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'Save',
          handler: data => {
            this.note = data;
            this.tripService.setNote(data);
            console.log('Saved clicked');
          }
        }
      ]
    });
    prompt.present();
  };

  // go to next view when the 'Book' button is clicked
  book() {
    console.log("Book !!!");
    this.locateDriver = true;
    // store detail
    this.tripService.setAvailableDrivers(this.activeDrivers);
    this.tripService.setDistance(this.distance);
    this.tripService.setFee(this.currentVehicle.fee);
    this.tripService.setIcon(this.currentVehicle.icon);
    this.tripService.setNote(this.note);
    this.tripService.setPromo(this.promocode);
    this.tripService.setDiscount(this.discount);
    // this.tripService.setPaymentMethod('');
    this.drivers = this.tripService.getAvailableDrivers();
    // sort by driver distance and rating
    this.drivers = this.dealService.sortDriversList(this.drivers);

    if (this.drivers) {
      this.makeDeal(0);
    }
    
  }

  makeDeal(index) {
    let driver = this.drivers[index];
    let dealAccepted = false;

    if (driver) {
      driver.status = 'Bidding';
      this.dealService.getDriverDeal(driver.$key).take(1).subscribe(snapshot => {
        // if user is available
        if (snapshot.$value === null) {
          // create a record
          console.log(snapshot);
          this.dealService.makeDeal(
              driver.$key,
              this.tripService.getOrigin(),
              this.tripService.getDestination(),
              this.tripService.getDistance(),
              this.tripService.getFee(),
              this.tripService.getCurrency(),
              this.tripService.getNote(),
              this.tripService.getPaymentMethod(),
              this.tripService.getPromo(),
              this.tripService.getDiscount()
          ).then(() => {
            let sub = this.dealService.getDriverDeal(driver.$key).subscribe(snap => {
              // if record doesn't exist or is accepted
              if (snap.$value === null || snap.status != DEAL_STATUS_PENDING) {
                sub.unsubscribe();

                // if deal has been cancelled
                if (snap.$value === null) {
                  this.nextDriver(index);
                } else if (snap.status == DEAL_STATUS_ACCEPTED) {
                  // if deal is accepted
                  console.log('accepted', snap.tripId);
                  dealAccepted = true;
                  this.drivers = [];
                  this.tripService.setId(snap.tripId);
                  // go to user page
                  this.nav.setRoot(TrackingPage);
                }
              }
            });
          });
        } else {
          this.nextDriver(index);
        }
      });
    } else {
      // show error & try again button
      console.log('No user found');
      this.locateDriver = false;
      this.alertCtrl.create({
        subTitle:'No Driver Found',
        buttons: ['OK']
      }).present();
    }
  }

  // make deal to next driver
  nextDriver(index) {
    this.drivers.splice(index, 1);
    this.makeDeal(index);
  }

  // choose origin place
  chooseOrigin() {
    // go to places page
    this.nav.push(PlacesPage, {type: 'origin'});
  }

  // choose destination place
  chooseDestination() {
    // go to places page
    this.nav.push(PlacesPage, {type: 'destination'});
  }

  // choose payment method
  choosePaymentMethod() {
    // go to payment method page
    this.nav.push(PaymentMethodPage);
  }

  // add origin marker to map
  setOrigin() {
    // add origin and destination marker
    let latLng = new google.maps.LatLng(this.origin.location.lat, this.origin.location.lng);
    let startMarker = new google.maps.Marker({
      map: this.map,
      animation: google.maps.Animation.DROP,
      position: latLng
    });
    startMarker.setMap(this.map);
    if(this.destination)
      startMarker.setMap(null);
    // set map center to origin address
    this.map.setCenter(latLng);
  }

  showLoading() {
    this.loading = this.loadingCtrl.create({
      content: 'Please wait...'
    });
    this.loading.present();
  }

  hideLoading() {
    this.loading.dismiss();
  }

  // show or hide vehicles
  toggleVehicles() {
    this.showVehicles = !this.showVehicles;
    this.showModalBg = (this.showVehicles == true);
  }

  // track drivers
  trackDrivers() {
    this.showDriverOnMap(this.locality);
    clearInterval(this.driverTracking);

    this.driverTracking = setInterval(() => {
      this.showDriverOnMap(this.locality);
    }, POSITION_INTERVAL);

    console.log(POSITION_INTERVAL);
  }

  // show drivers on map
  showDriverOnMap(locality) {
    // get active drivers
    this.driverService.getActiveDriver(locality, this.currentVehicle.id).take(1).subscribe(snapshot => {
      console.log('fresh vehicles :'+JSON.stringify(snapshot));
      // clear vehicles
      this.clearDrivers();

      // only show near vehicle
      snapshot.forEach(vehicle => {
        console.log(vehicle);
        // only show vehicle which has last active < 30 secs & distance < 5km
        let distance = this.placeService.calcCrow(vehicle.lat, vehicle.lng, this.origin.location.lat, this.origin.location.lng);
        console.log(distance);
        console.log("distance:"+distance+" Last Active: "+(Date.now() - vehicle.last_active));
        // checking last active time and distance
        if (distance < SHOW_VEHICLES_WITHIN && Date.now() - vehicle.last_active < VEHICLE_LAST_ACTIVE_LIMIT) {
          // create or update
          let latLng = new google.maps.LatLng(vehicle.lat, vehicle.lng);

          let marker = new google.maps.Marker({
            map: this.map,
            position: latLng,
            icon: {
              url: this.currentVehicle.map_icon,
              size: new google.maps.Size(32, 32),
              origin: new google.maps.Point(0, 0),
              anchor: new google.maps.Point(16, 16),
              scaledSize: new google.maps.Size(32, 32)
            },
          });

          // add vehicle and marker to the list
          vehicle.distance = distance;
          console.log(marker);
          this.driverMarkers.push(marker);
          this.activeDrivers.push(vehicle);
        } 
        else {
          console.log('This vehicle is too far');
          // let toast = this.toastCtrl.create({
          //   message: 'This vehicle is too far',
          //   duration: 2000,
          //   position:'top'
          // });
          // toast.present();
        }
      });
    });
  }

  // clear expired drivers on the map
  clearDrivers() {
    this.activeDrivers = [];
    this.driverMarkers.forEach((vehicle) => {
      vehicle.setMap(null);
    });
  }

  /** 17th August Starts **/

  // onSubmit() {
  //   // this.resetUI();
  //   switch(this.mile_active){
  //     case NONE:{
  //       if(!(this.origin && this.destination)){
  //         console.log('focus searchbar', this.open);
  //         this.searchbar.setFocus();
  //         break;
  //       }

  //       if(this.request_status == REQUEST_PENDING){
  //         this.tripService.nextRequestStatus();
  //       }

  //       break;
  //     }
  //     case LAST_MILE:
  //     case FIRST_MILE:{
  //       this.show_driver = !this.show_driver;
  //       break;
  //     }
  //     case TRANSIT:{
  //       this.visible_booking_form_about = !this.visible_booking_form_about;
  //       // this.tripService.checkTransitEnd();
  //       if(!this.visible_booking_form_about)
  //         this.checkTransitEnd();
  //       break;
  //     }
  //     case DONE:{
  //       this.untrackRequest();
  //       this.untrackJourney();
  //       this.cancelRequest();
  //       break;
  //     }
  //   }
  // }

  submitWithDestination(){
    console.log("Origin :"+JSON.stringify(this.origin));
    console.log("Destination :"+JSON.stringify(this.destination));
    if (this.destination) {
      console.log(this.origin);
      console.log(this.destination);
      this.setDestination();
      this.requestJourney();
    }
  }

  setDestination() {
    // add origin and destination marker
    let latLng = new google.maps.LatLng(this.destination.location.lat, this.destination.location.lng);
    this.destination_marker.setMap(null);
    this.destination_marker = new google.maps.Marker({
      map: this.map,
      animation: google.maps.Animation.DROP,
      position: latLng,
      icon: 'assets/img/baloon.png'
    });

    // set map center to origin address
    this.bounds.extend(latLng);
    this.map.fitBounds(this.bounds);
  }

  cancelRequest(){
    this.closeSummaryCard();
    this.destination = null;
    this.origin = null;
    this.tripService.cancelRequest().then(()=>{
      // this.mile_active = NONE;
    })
    this.loadMap();
  }

  closeSummaryCard(){
    this.ui_state = "CLEAR";
    // this.slideUp = false;
    // this.slideDown = true;
    // this.open = false;
  }

  requestJourney(){
    var self = this;
    var user = this.authService.getUserData();
    // var user_phone_number = user.phoneNumber;
    var user_id = user.uid;

    // console.log("Phone Number :"+user_phone_number);

    this.metroSearch(()=>{
      console.log('REQUEST DOC, AFTER METRO SEARCH'+JSON.stringify(self.request_doc));
      self.formatRequest(self.request_doc)
      self.tripService.setRequest({
        userid: user_id,
        // phoneNumber: user_phone_number,
        status: REQUEST_PENDING,
        ...self.request_doc
      })
    })
  }

  formatRequest(request){
    var first = new Place(request.first_mile_metro_details.vicinity,request.first_mile_metro_details.geometry.location.lat, request.first_mile_metro_details.geometry.location.lng, request.first_mile_metro_details.place_id);
    request.first_mile_metro_details = first.getFormatted();
    var last = new Place(request.last_mile_metro_details.vicinity,request.last_mile_metro_details.geometry.location.lat, request.last_mile_metro_details.geometry.location.lng, request.last_mile_metro_details.place_id);
    request.last_mile_metro_details = last.getFormatted();
      console.log(request.origin_end_time, request.origin_start_time, request.destination_end_time, request.transit_end_time)
    request.origin_end_time = request.origin_end_time.getTime();
    request.origin_start_time = request.origin_start_time.getTime();
    request.destination_end_time = request.destination_end_time.getTime();
    if(request.transit_end_time)
      request.transit_end_time = request.transit_end_time.getTime();
  }  

  metroSearch(callback=null){
    var self = this;
    console.log("metro search called");
    self.request_doc = {};
    self.request_doc.total_solo_fare = 0;
    self.request_doc.first_mile_solo_fare = 0;
    self.request_doc.first_mile_share_fare = 0;
    self.request_doc.last_mile_share_fare = 0;
    self.request_doc.last_mile_solo_fare = 0;
    self.request_doc.total_time = 0;
    self.request_doc.total_share_fare = 0;
    self.request_doc.transit_stops = 0;
    self.request_doc.origin = self.origin;
    self.request_doc.destination = self.destination;
    self.request_doc.first_mile_service = false;
    self.request_doc.last_mile_service = false;
    self.transit_info = {};
    // get 2 metro stations nearest to origin and destination
    self.printDocDetails('REQUEST_DOC => BEFORE GET NEARBY METRO:',self.request_doc);
    Observable.forkJoin([
      Observable.fromPromise(self.getNearbyMetro(self.request_doc.origin.location, self)),
      Observable.fromPromise(self.getNearbyMetro(self.request_doc.destination.location, self))
    ]).subscribe(results => {
        console.log("Result :"+JSON.stringify(results));
        self.request_doc.first_mile_metro_details = results[0];
        self.request_doc.last_mile_metro_details = results[1];

        self.request_doc.origin_start_time = new Date();
        self.printDocDetails('REQUEST_DOC',self.request_doc)
        var first_mile_location = {lat: self.request_doc.first_mile_metro_details.geometry.location.lat(), lng: self.request_doc.first_mile_metro_details.geometry.location.lng()};
        self.request_doc.first_mile_metro_details.geometry.location = first_mile_location;
        ;
        var last_mile_location = {lat: self.request_doc.last_mile_metro_details.geometry.location.lat(), lng: self.request_doc.last_mile_metro_details.geometry.location.lng()};
        self.request_doc.last_mile_metro_details.geometry.location = last_mile_location

        self.tripFare(self.request_doc.origin.location, first_mile_location, self.request_doc.origin_start_time, function(duration, fare, route){
          console.log("route_first_mile", route)
          let distance =  route.legs[0].distance.text;
          let distance_in_number = distance.substring(0,distance.length -4);
          if(results[0]["name"] == "Baiyappanahalli Metro Station" && distance_in_number<5){
            self.request_doc.first_mile_service = true;
          }

          self.request_doc.first_mile_solo_fare = fare;
          self.request_doc.first_mile_share_fare = Math.trunc(fare*0.6);
          console.log("first_mile_solo_fare :"+fare);

          self.request_doc.first_mile_duration = duration;
          console.log("first_mile_duration :"+JSON.stringify(duration));
          let duration_time = duration.text.match(/\d+/);
          self.request_doc.total_time += parseInt(duration_time)

          self.request_doc.total_solo_fare += self.request_doc.first_mile_solo_fare;
          self.request_doc.total_share_fare += self.request_doc.first_mile_share_fare;
          self.request_doc.origin_end_time = self.addSeconds(self.origin_start_time, route.legs[0].duration.value);
          console.log(route);
          self.printDocDetails("TRIP FARE CALLBACK (1)", self.request_doc)
          self.metroFare(first_mile_location, last_mile_location, self.request_doc.origin_end_time, function(route){
          console.log("METOR FARE CALLBACK (1)", self.request_doc)

            var next = (new Date());
              console.log('transit route', route)

            if(route){
              // set fare
              self.request_doc.metro_fare = route.fare.value;
              self.request_doc.total_solo_fare += self.request_doc.metro_fare;
              self.request_doc.total_share_fare += self.request_doc.metro_fare;

              // find estimated time to start next ride
              self.request_doc.transit_end_time = self.addSeconds(self.origin_end_time, route.legs[0].duration.value);
              next = self.request_doc.transit_end_time;

              self.request_doc.transit_duration = route.legs[0].duration.text;
              // for the info on template
              self.request_doc.transit_duration_number = self.request_doc.transit_duration.split(' ')[0];
              self.request_doc.transit_duration_text = self.request_doc.transit_duration.split(' ')[1];

              self.request_doc.total_time += parseInt(self.request_doc.transit_duration.split(' ')[0]);

              self.transit_info = route.legs[0].steps;

              var lines = [];
              console.log("TRANSIT INFO ****", self.transit_info, route)
              self.transit_info.forEach((ele, index)=>{
                if(ele.travel_mode == "TRANSIT"){
                  console.log("TRANSIT INFO ", index,ele)
                  lines.push(ele.transit.line.short_name);
                  self.request_doc.transit_stops += ele.transit.num_stops;
                }
              });
              self.request_doc.transit_lines_text = lines.join(" > ");
              self.request_doc.transit_first_line = lines[0];
              if(lines[1])
                self.request_doc.transit_second_line = lines[1];

              if(self.request_doc.transit_end_time){
                if(self.request_doc.transit_end_time.getMinutes() < 10)
                  self.request_doc.transit_end_time_text = self.request_doc.transit_end_time.getHours() +":0" + self.request_doc.transit_end_time.getMinutes()
                else
                  self.request_doc.transit_end_time_text = self.request_doc.transit_end_time.getHours() +":" + self.request_doc.transit_end_time.getMinutes()
              }else{
                self.request_doc.transit_end_time_text = "NA";
              }
                console.log(self.transit_info)
            }else{
              self.request_doc.transit_lines_text = "METRO NOT AVAILABLE";
            }
            self.printDocDetails("METRO FARE CALLBACK", self.request_doc)
            // find fare , duration, route of last mile
            self.tripFare(last_mile_location,self.request_doc.destination.location, next, function(duration, fare, route){
              console.log("route_last_mile", route)
              let distance =  route.legs[0].distance.text;
              let distance_in_number = distance.substring(0,distance.length -4);
              if(results[1]["name"] == "Baiyappanahalli Metro Station" && distance_in_number<5){
                self.request_doc.last_mile_service = true;
              }
              console.log("first_mile_service",self.request_doc.first_mile_service, "last_mile_service",self.request_doc.last_mile_service);
              self.printDocDetails("TRIP FARE CALLBACK", self.request_doc)
              self.request_doc.last_mile_solo_fare = fare;
              self.request_doc.last_mile_share_fare = Math.trunc(fare*0.6);

              self.request_doc.total_solo_fare += self.request_doc.last_mile_solo_fare;
              self.request_doc.total_share_fare += self.request_doc.last_mile_share_fare;

              self.request_doc.last_mile_duration = duration;
              let duration_time = duration.text.match(/\d+/);
              self.request_doc.total_time += parseInt(duration_time);
              self.request_doc.destination_end_time = self.addSeconds((self.request_doc.transit_end_time || self.request_doc.origin_end_time), route.legs[0].duration.value);
              self.printDocDetails('DESTINATION END TIME',self.request_doc.destination_end_time);
              self.request_doc.destination_end_time_text = self.request_doc.destination_end_time.getHours() +":" + ("0" + self.request_doc.destination_end_time.getMinutes()).slice(-2);
              if(callback)
                callback()
            });
          });

        });

    })

  }

  addSeconds(start, seconds){
    var time = start?start.getTime():Date.now();
    return new Date(time + seconds*1000);
  }

  getNearbyMetro(position_latlong: any, env:any){
    var self = env;
    console.log('getNearbyMetro for :'+JSON.stringify(position_latlong));

    var location = new google.maps.LatLng(position_latlong.lat, position_latlong.lng);

    var request = {
      location: location,
      rankBy: google.maps.places.RankBy.DISTANCE,
      types: ["subway_station"]
    }

    return (new Promise(function(resolve, rejected){
      self.placesService = new google.maps.places.PlacesService(self.map);
      self.placesService.nearbySearch(request, callback);

      function callback(data, status){
        console.log("Data :"+JSON.stringify(data)+" && Status :"+JSON.stringify(status));
        if(status == google.maps.places.PlacesServiceStatus.OK){
          console.log('page -> getNearbyMetro ->'+JSON.stringify(data));
          resolve(data[0]);
          self.ui_state = "TRIP_DETAILS";
        }
        else{
          console.log("No Results !");
          rejected(status);
          self.ui_state = "NO_TRIP_DETAILS";
        }
      }
    }))
  }

  trackRequest(){
    console.log("TRACK REQUEST");
    this.track_request_doc = this.tripService.getRequestDoc().subscribe(doc=>{
        console.log('track request doc'+JSON.stringify(doc));
      if(doc){
        this.request_doc = doc;
        this.destination = doc["destination"];
      }
    });
  }

  metroFare(latlng1, latlng2, departureTime, callback){
    var request = {
      origin:  latlng1,
      destination: latlng2,

      travelMode: "TRANSIT",
      transitOptions:{
        modes: ['SUBWAY'],
        "departureTime": departureTime
      },
      provideRouteAlternatives: true,
    }

    console.log("METRO FARE...", request)
    var self = this;
    this.directionsService.route(request, function(result, status){
        console.log("METRO FARE", status, result)
      if(status == "OK"){
        console.log('transit fastest routes', result);
        var route = self.findRoute(0, result.routes);
        if(route != null){
            console.log('found Fare B)')
        }else{
            console.log("finding fare failed")
        }
        callback(route);
      }
    });
  }

  // finds the fastest route with fare property
  findRoute(i, routes){
      console.log(i, routes);
    if(i >= routes.length){
      return null;
    }
    if(Object.keys(routes[i]).indexOf("fare") != -1){
      return (routes[i]);
    }
    return this.findRoute(++i,routes);
  }

  tripFare(latlng1,latlng2,departureTime, callback){
    var request = {
      origin: latlng1.lat + ',' + latlng1.lng,
      destination: latlng2.lat + ',' + latlng2.lng,
      travelMode: "DRIVING",
      drivingOptions:{
        "departureTime": departureTime
      }
    }

    var self = this;
    this.directionsService.route(request, function(result, status){
      if(status == "OK"){
        console.log('milefare', result.routes[0].legs[0])
        var distance = result.routes[0].legs[0].distance;
        var duration = result.routes[0].legs[0].duration;
        var fare = Math.round(self.base_fare + (distance.value/1000)*self.per_km_fare);
        console.log("Fare :"+fare+" && Duration :"+JSON.stringify(duration)+" && Duration Calc :"+duration.text.match(/\d+/));
        console.log(fare, distance.value, self.per_km_fare)
        // callback(duration.text.match(/\d+/), fare, result.routes[0])
        callback(duration, fare, result.routes[0])
      }
    });
  }

  enableSolo(){
    console.log("Solo Clicked !!!");
    this.mode_active = "solo";
    this.tripService.setModeActive(this.mode_active);
  }

  enableShare(){
    console.log("Share Clicked !!!");
    this.mode_active = "share";
    this.tripService.setModeActive(this.mode_active);
    this.show_popup_share = !this.show_popup_share;
  }

  printDocDetails(text, doc){
    console.log(text, doc.origin, doc.destination, doc);
  }

  /** 17th August Ends **/

}