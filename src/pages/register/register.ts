import { Component } from '@angular/core';
import { NavController, LoadingController, AlertController, ToastController } from 'ionic-angular';
import { LoginPage } from '../login/login';
import { HomePage } from "../home/home";
import { AuthService } from "../../services/auth-service";
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'page-register',
  templateUrl: 'register.html'
})
export class RegisterPage {
  email: string = "";
  password: string = "";
  name: string = "";
  phoneNumber: string = ""
  constructor(public nav: NavController, public authService: AuthService, public alertCtrl: AlertController, public loadingCtrl: LoadingController, public translate: TranslateService, public toastCtrl: ToastController) {}

  signup() {
      (<any>window).AccountKitPlugin.loginWithPhoneNumber({
        useAccessToken: true,
        defaultCountryCode: "IN",
        facebookNotificationsEnabled: true,
        initialPhoneNumber: ["+91", this.phoneNumber]
      }, data => {
        let loading = this.loadingCtrl.create({ content: 'Authenticating...' });
        loading.present();
        var self = this;
        self.email = self.phoneNumber+'@gmail.com';
          self.password = self.phoneNumber;
        self.authService.register(self.email, self.password, self.name, self.phoneNumber).subscribe(authData => {
          loading.dismiss();
          self.nav.setRoot(HomePage);
        }, error => {
          loading.dismiss();
          let alert = self.alertCtrl.create({
            message: error.message.replace('email address', 'phone number'),
            buttons: ['OK']
          });
          alert.present();
        });
        }, err => {
          this.displayToast("Unable to sign in");
        });
    }

  login() {
    this.nav.setRoot(LoginPage);
  }

  displayToast(message) {
    this.toastCtrl.create({ duration: 2000, message }).present();
  }
}
