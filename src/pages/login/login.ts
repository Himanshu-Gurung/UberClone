import { Component } from '@angular/core';
import { NavController, AlertController, LoadingController, ToastController } from 'ionic-angular';
import { RegisterPage } from '../register/register';
import { HomePage } from '../home/home'
import { AuthService } from "../../services/auth-service";
import * as firebase from 'firebase';
import { ENABLE_SIGNUP } from '../../services/constants';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'page-login',
  templateUrl: 'login.html'
})
export class LoginPage {
  phoneNumber: string = "";
  email: string = "";
  password: string = "";
  isRegisterEnabled:any = true;
  constructor(public nav: NavController, public authService: AuthService, public alertCtrl: AlertController, public loadingCtrl: LoadingController, public toastCtrl: ToastController, public translate: TranslateService) {
    this.isRegisterEnabled = ENABLE_SIGNUP;
  }

  signup() {
    this.nav.setRoot(RegisterPage);
  }

  login() {
    (<any>window).AccountKitPlugin.loginWithPhoneNumber({
      useAccessToken: true,
      defaultCountryCode: "IN",
      facebookNotificationsEnabled: true,
      initialPhoneNumber: ["+91", this.phoneNumber]
    }, data => {
      let loading = this.loadingCtrl.create({ content: 'Authenticating...' });
      loading.present();

      var self = this;
      self.email = self.phoneNumber + '@gmail.com';
      self.password = self.phoneNumber;
      self.authService.login(self.email, self.password).then(authData => {
        loading.dismiss();
        self.nav.setRoot(HomePage);
      }, error => {
        // in case of login error
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
  displayToast(message) {
    this.toastCtrl.create({ duration: 2000, message }).present();
  }
}
