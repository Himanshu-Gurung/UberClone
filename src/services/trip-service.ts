import { Injectable } from "@angular/core";
import { AngularFireDatabase } from "angularfire2/database/database";
import { Place } from "./place";
import { AuthService } from "./auth-service";

@Injectable()
export class TripService {
  private id: any;
  private trips: any;
  private currency: string;
  private origin: any;
  private destination: any;
  private distance: number;
  private fee: number;
  private note: string;
  private paymentMethod: any = 'cash';
  private vehicle: any;
  private promocode: any;
  private discount: any;
  private new_entry: any;
  // vehicle's icon
  private icon: any;
  private availableDrivers: Array<any> = [];

  private request_doc: any;
  private request_status: any;  

  constructor(public db: AngularFireDatabase, public authService: AuthService) {

  }

  getAll() {
    return this.trips;
  }

  setId(id) {
    return this.id = id;
  }

  getId() {
    return this.id;
  }

  setCurrency(currency) {
    return this.currency = currency;
  }

  getCurrency() {
    return this.currency;
  }

  setOrigin(vicinity, lat, lng) {
    let place = new Place(vicinity, lat, lng);
    return this.origin = place.getFormatted();
  }

  getOrigin() {
    return this.origin;
  }

  setDestination(vicinity, lat, lng) {
    let place = new Place(vicinity, lat, lng);
    return this.destination = place.getFormatted();
  }

  getDestination() {
    return this.destination
  }

  setDistance(distance) {
    return this.distance = distance;
  }

  getDistance() {
    return this.distance;
  }

  setFee(fee) {
    return this.fee = fee;
  }

  getFee() {
    return this.fee;
  }

  setNote(note) {
    return this.note = note;
  }

  getNote() {
    return this.note;
  }

  setPromo(promocode){
    return this.promocode = promocode;
  }
  getPromo(){
    return this.promocode;
  }
  
  setDiscount(discount){
    return this.discount = discount;
  }
  getDiscount(){
    return this.discount;
  }

  setPaymentMethod(method) {
    return this.paymentMethod = method;
  }

  getPaymentMethod() {
    return this.paymentMethod;
  }

  setVehicle(vehicle) {
    return this.vehicle = vehicle;
  }

  getVehicle() {
    return this.vehicle;
  }

  setIcon(icon) {
    return this.icon = icon;
  }

  getIcon() {
    return this.icon;
  }

  setAvailableDrivers(vehicles) {
    console.log(vehicles);
    this.availableDrivers = vehicles;
  }

  getAvailableDrivers() {
    return this.availableDrivers;
  }

  getTrip(id) {
    return this.db.object('trips/' + id);
  }

  getTrips() {
    let user = this.authService.getUserData();
    console.log(user);
    return this.db.list('trips', {
      query: {
        orderByChild: 'passengerId',
        equalTo: user.uid
      }
    });
  }

  getRequestDoc(){
    let user = this.authService.getUserData();
    return this.db.object('requestJourney/'+ user.uid).valueChanges().map(doc=>{
      // console.log("REQUEST_DOC", doc)
      this.request_doc = doc;
      console.log("GET REQUEST DOC", doc ,"&& SET REQUEST STATUS");
      if(doc){
        this.setRequestStatus(doc["status"])
      }
      else
        this.setRequestStatus(REQUEST_NONE);
      return doc;
    });
  }

  setRequest(data){
    let user = this.authService.getUserData();
    console.log("Set Request Data :"+JSON.stringify(data));
    this.new_entry = this.db.list('requestJourney/'+ user.uid);
    return this.new_entry.push(data);
  }

  cancelRequest(){
    let user = this.authService.getUserData();
    return this.db.object('requestJourney/'+ user.uid).remove();
  }

  setModeActive(mode) {
    return this.mode_active = mode;
  }

  nextRequestStatus(){
    var status;

    if(this.request_status == REQUEST_NONE ){
      status = REQUEST_PENDING;
    }else if(this.request_status == REQUEST_PENDING ){
      status = REQUEST_DONE;
    }else if(this.request_status == REQUEST_DONE){
      status = REQUEST_DONE;
    }
    let user = this.authService.getUserData();
    return this.db.object("requestJourney/" + user.uid).update({
      "status": status,
    }).then(()=>{
      console.log("NEXT REQUEST STATUS",this.request_status, ">>", status);
      this.setRequestStatus(status);
    });
  }

  setRequestStatus(status){
    console.log("SET REQUEST STATUS >> ", status)
    if(status != this.request_status){
      this.request_status = status;
      // console.log("set Request Status", status);
      this.request_status$.next(this.request_status);
      return this.request_status;
    }else{
      return null;
    }
  }

  cancelTrip(id){
    return this.db.object('trips/'+id).update({ status: 'canceled'})
  }

  rateTrip(tripId, stars) {
    return this.db.object('trips/' + tripId).update({
      rating: parseInt(stars)
    });
  }
}