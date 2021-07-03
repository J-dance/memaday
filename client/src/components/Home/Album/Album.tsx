import React from 'react'
import festivalImage from '../../../assets/images/festival.jpg'
import styles from './Album.module.scss'

const Album = () => {
  return (
    <div className={styles.albumContainer}>
      <img src={festivalImage} alt="festival image" />
      <p className={styles.albumText}>Uploaded: User123</p>
    </div>
  )
}

export default Album
