import React from 'react'
import styles from './Home.module.scss'
import { Link } from 'react-router-dom'
// Carousel/Swiper requirements ---
import { Swiper, SwiperSlide } from 'swiper/react'
import SwiperCore, { Navigation, Pagination, Scrollbar, A11y } from 'swiper'
import 'swiper/swiper.scss'
import 'swiper/components/navigation/navigation.scss'
import 'swiper/components/pagination/pagination.scss'
//  ----
import uploadImage from '../../assets/images/upload-image.png'
import logo from '../../assets/SVGs/logo.svg'
import Album from './Album/Album'
import shareSVG from '../../assets/SVGs/share.svg'
import speechSVG from '../../assets/SVGs/speech.svg'

// install Swiper modules
SwiperCore.use([Navigation, Pagination, Scrollbar, A11y]);

const Home = () => {
  return (
    <section className={styles.homePage}>
      {/* log in button */}
      <Link to='/login'>
        <button className={`${styles.button} ${styles.loginButton}`}>Log in</button>
      </Link>
      <div className={styles.homePageBackground}>
        {/* Background div containers */}
        <div className={styles.leftUpperCorner}></div>
        <div className={styles.rightUpperCorner}></div>
        <div className={styles.leftLowerCorner}></div>
        <div className={styles.rightLowerCorner}></div>
        {/* page content goes below */}
        <div className={styles.titleContainer}>
          <div className={styles.titleAntiContainer}>
              <img className={styles.logoImg} src={logo} />
              <div className={styles.textContainer}>
                <h1 className={styles.title}>memAday</h1>
                <p className={styles.slogan}>Get the joy of forgotten memories!</p>
              </div>
              {/* Carousel with app features in slides */}
              <Swiper
                className={styles.carousel}
                spaceBetween={0}
                slidesPerView={1}
                navigation
                pagination={{ clickable: true }}
              >
                {/* Slide 1 */}
                <SwiperSlide className={styles.slide}>
                  <img className={styles.uploadImg} src={uploadImage} alt="Uploaded Images"/>
                  <h1 className={styles.title}>Upload</h1>
                </SwiperSlide>
                {/* Slide 2 */}
                <SwiperSlide className={styles.slide}>
                  <div className={styles.albumContainer}>
                    <Album />
                  </div>
                  <img className={styles.shareSVG} src={shareSVG} />
                  <h1 className={styles.title}>Share</h1>
                </SwiperSlide>
                {/* Slide 3 */}
                <SwiperSlide className={styles.slide}>
                <img className={`${styles.speechBubble} ${styles.flip}`} src={speechSVG} />
                  <div className={styles.albumContainer}>
                    <Album />
                  </div>
                  <img className={styles.speechBubble} src={speechSVG} />
                  <h1 className={styles.title}>Chat</h1>
                </SwiperSlide>
                {/* Slide 4 */}
                <SwiperSlide className={styles.slide}>
                <h1 className={styles.title}>Remember.</h1>
                </SwiperSlide>
              </Swiper>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Home
