let globalData = [];
let regionSelect = null;
let crimeSelect = null;
let mapBuilt = false;

/* ============================================================
 * UZBEKISTAN MAP — auto-extracted from a public-domain Uzbekistan
 * vector map (uzbekistan-map-vector-1606349.avif).  The country
 * silhouette and per-viloyat polygons were traced via OpenCV
 * contour extraction, then Douglas–Peucker simplified, and scaled
 * to a 1000x580 viewBox.  Toshkent shahri is too small in the
 * source image to produce a clean polygon, so it is rendered as
 * a marker only.  See _extract_map.py for the pipeline.
 * ============================================================ */
const COUNTRY_OUTLINE = "M 27.3 29.0 L 6.5 223.9 L 0.0 225.0 L 0.0 280.7 L 62.5 287.7 L 57.3 250.6 L 80.7 229.7 L 113.3 228.5 L 119.8 210.0 L 131.5 210.0 L 140.6 222.7 L 148.4 223.9 L 140.6 199.5 L 165.4 197.2 L 174.5 207.6 L 186.2 207.6 L 195.3 222.7 L 227.9 226.2 L 234.4 232.0 L 230.5 251.7 L 238.3 254.0 L 235.7 288.8 L 251.3 297.0 L 251.3 316.7 L 287.8 316.7 L 289.1 306.2 L 328.1 301.6 L 343.8 315.5 L 351.6 344.5 L 368.5 363.1 L 371.1 386.3 L 472.7 460.5 L 487.0 460.5 L 561.2 509.2 L 585.9 508.1 L 621.1 522.0 L 618.5 567.2 L 625.0 569.6 L 652.3 567.2 L 658.9 578.8 L 699.2 578.8 L 699.2 553.3 L 714.8 526.6 L 724.0 523.2 L 729.2 505.8 L 708.3 483.7 L 708.3 469.8 L 714.8 465.2 L 709.6 453.6 L 686.2 454.7 L 683.6 444.3 L 668.0 439.6 L 668.0 422.2 L 681.0 411.8 L 730.5 415.3 L 738.3 394.4 L 753.9 390.9 L 756.5 382.8 L 800.8 382.8 L 802.1 377.0 L 777.3 373.5 L 777.3 328.3 L 799.5 335.2 L 835.9 310.9 L 846.4 310.9 L 851.6 331.8 L 837.2 349.2 L 852.9 361.9 L 873.7 360.8 L 880.2 382.8 L 889.3 382.8 L 891.9 368.9 L 882.8 365.4 L 884.1 355.0 L 920.6 360.8 L 940.1 339.9 L 958.3 342.2 L 962.2 331.8 L 971.4 331.8 L 983.1 316.7 L 998.7 312.0 L 998.7 306.2 L 958.3 301.6 L 959.6 291.2 L 998.7 291.2 L 998.7 286.5 L 958.3 285.4 L 954.4 294.6 L 941.4 294.6 L 938.8 286.5 L 923.2 286.5 L 907.6 264.5 L 904.9 280.7 L 895.8 281.9 L 893.2 292.3 L 859.4 293.5 L 854.2 276.1 L 828.1 276.1 L 826.8 265.6 L 843.8 248.2 L 877.6 227.4 L 864.6 218.1 L 851.6 223.9 L 846.4 234.3 L 830.7 235.5 L 811.2 257.5 L 791.7 264.5 L 774.7 280.7 L 760.4 284.2 L 756.5 300.4 L 731.8 320.2 L 731.8 338.7 L 718.8 339.9 L 704.4 331.8 L 704.4 312.0 L 692.7 303.9 L 622.4 306.2 L 608.1 251.7 L 579.4 250.6 L 583.3 184.4 L 565.1 186.8 L 548.2 161.2 L 533.9 154.3 L 516.9 134.6 L 489.6 146.2 L 418.0 140.4 L 350.3 148.5 L 306.0 99.8 L 299.5 84.7 L 183.6 8.1 L 179.7 0.0 L 144.5 0.0 L 143.2 5.8 Z";

const REGIONS = {
    "Qoraqalpog'iston Respublikasi": {
        path: "M 27.3 30.2 L 0.0 279.6 L 58.6 288.8 L 65.1 281.9 L 57.3 247.1 L 82.0 228.5 L 112.0 228.5 L 119.8 208.8 L 132.8 210.0 L 148.4 223.9 L 136.7 196.0 L 164.1 194.9 L 175.8 207.6 L 187.5 207.6 L 194.0 221.6 L 238.3 229.7 L 260.4 250.6 L 264.3 263.3 L 308.6 301.6 L 329.4 301.6 L 347.7 324.8 L 368.5 316.7 L 334.6 270.3 L 333.3 258.7 L 346.4 251.7 L 339.8 215.8 L 381.5 169.4 L 356.8 157.8 L 300.8 89.3 L 266.9 119.5 L 259.1 140.4 L 248.7 145.0 L 233.1 140.4 L 231.8 148.5 L 222.7 148.5 L 221.4 136.9 L 227.9 134.6 L 214.8 132.2 L 212.2 124.1 L 187.5 123.0 L 179.7 113.7 L 171.9 127.6 L 152.3 131.1 L 147.1 125.3 L 152.3 95.1 L 143.2 84.7 L 143.2 68.4 L 149.7 65.0 L 143.2 46.4 L 168.0 0.0 Z",
        center: [166.2, 162.7],
        short: "Qoraqalpog'iston"
    },
    "Xorazm viloyati": {
        path: "M 229.2 226.2 L 234.4 232.0 L 234.4 245.9 L 230.5 248.2 L 230.5 250.6 L 240.9 254.0 L 240.9 261.0 L 238.3 264.5 L 239.6 268.0 L 239.6 277.2 L 235.7 280.7 L 235.7 287.7 L 239.6 292.3 L 247.4 293.5 L 255.2 300.4 L 259.1 301.6 L 294.3 301.6 L 299.5 306.2 L 307.3 307.4 L 309.9 305.1 L 309.9 302.8 L 304.7 300.4 L 303.4 294.6 L 300.8 292.3 L 295.6 292.3 L 290.4 286.5 L 282.6 280.7 L 276.0 277.2 L 274.7 273.8 L 266.9 268.0 L 263.0 263.3 L 263.0 261.0 L 260.4 259.8 L 260.4 254.0 L 259.1 252.9 L 259.1 250.6 L 252.6 250.6 L 248.7 245.9 L 248.7 240.1 L 233.1 227.4 Z",
        center: [261.0, 277.0],
        short: "Xorazm"
    },
    "Navoiy viloyati": {
        path: "M 354.2 149.6 L 367.2 165.9 L 380.2 169.4 L 380.2 176.3 L 341.1 215.8 L 346.4 252.9 L 333.3 258.7 L 335.9 270.3 L 358.1 297.0 L 384.1 291.2 L 395.8 326.0 L 402.3 321.3 L 436.2 334.1 L 436.2 344.5 L 441.4 348.0 L 447.9 346.8 L 445.3 334.1 L 449.2 330.6 L 457.0 330.6 L 459.6 336.4 L 476.6 336.4 L 480.5 322.5 L 502.6 323.6 L 507.8 338.7 L 516.9 346.8 L 543.0 345.7 L 544.3 353.8 L 535.2 361.9 L 515.6 364.2 L 509.1 389.8 L 498.7 394.4 L 507.8 413.0 L 520.8 413.0 L 522.1 422.2 L 531.2 423.4 L 532.6 402.5 L 548.2 396.7 L 549.5 386.3 L 576.8 387.4 L 583.3 379.3 L 588.5 351.5 L 615.9 355.0 L 622.4 343.4 L 630.2 343.4 L 622.4 327.1 L 628.9 310.9 L 619.8 305.1 L 608.1 251.7 L 579.4 250.6 L 583.3 184.4 L 565.1 189.1 L 549.5 163.6 L 532.6 154.3 L 515.6 134.6 L 490.9 146.2 L 412.8 141.5 Z",
        center: [484.4, 256.2],
        short: "Navoiy"
    },
    "Buxoro viloyati": {
        path: "M 359.4 298.1 L 367.2 309.7 L 367.2 319.0 L 350.3 324.8 L 347.7 332.9 L 356.8 352.6 L 368.5 360.8 L 372.4 386.3 L 399.7 408.3 L 434.9 429.2 L 447.9 444.3 L 476.6 460.5 L 496.1 450.1 L 509.1 450.1 L 513.0 438.5 L 522.1 433.8 L 528.6 425.7 L 523.4 423.4 L 524.7 415.3 L 522.1 413.0 L 505.2 413.0 L 498.7 400.2 L 498.7 393.2 L 506.5 389.8 L 514.3 366.6 L 527.3 365.4 L 544.3 351.5 L 544.3 345.7 L 532.6 343.4 L 526.0 348.0 L 513.0 346.8 L 503.9 335.2 L 502.6 317.8 L 500.0 316.7 L 496.1 324.8 L 480.5 324.8 L 479.2 337.6 L 462.2 337.6 L 460.9 327.1 L 457.0 326.0 L 446.6 335.2 L 447.9 348.0 L 438.8 349.2 L 434.9 345.7 L 433.6 334.1 L 407.6 321.3 L 402.3 323.6 L 393.2 322.5 L 393.2 314.4 L 382.8 303.9 L 382.8 292.3 Z",
        center: [444.8, 377.8],
        short: "Buxoro"
    },
    "Samarqand viloyati": {
        path: "M 675.8 397.9 L 668.0 396.7 L 665.4 394.4 L 654.9 395.6 L 651.0 392.1 L 651.0 384.0 L 647.1 384.0 L 644.5 381.6 L 644.5 377.0 L 635.4 375.8 L 632.8 373.5 L 634.1 358.4 L 628.9 355.0 L 630.2 339.9 L 628.9 344.5 L 621.1 345.7 L 619.8 351.5 L 592.4 348.0 L 588.5 353.8 L 588.5 368.9 L 584.6 379.3 L 578.1 386.3 L 556.0 386.3 L 549.5 382.8 L 548.2 395.6 L 537.8 396.7 L 535.2 401.4 L 527.3 401.4 L 526.0 404.8 L 527.3 407.2 L 531.2 407.2 L 533.9 409.5 L 533.9 421.1 L 529.9 424.6 L 553.4 425.7 L 571.6 423.4 L 575.5 431.5 L 580.7 436.2 L 585.9 433.8 L 593.8 433.8 L 596.4 437.3 L 599.0 437.3 L 600.3 432.7 L 608.1 432.7 L 610.7 436.2 L 613.3 436.2 L 619.8 425.7 L 630.2 425.7 L 643.2 435.0 L 647.1 433.8 L 648.4 429.2 L 658.9 429.2 L 666.7 432.7 L 668.0 421.1 L 671.9 419.9 L 669.3 413.0 L 669.3 404.8 L 671.9 401.4 L 675.8 400.2 Z",
        center: [605.1, 399.1],
        short: "Samarqand"
    },
    "Jizzax viloyati": {
        path: "M 630.2 330.6 L 628.9 332.9 L 632.8 339.9 L 632.8 348.0 L 630.2 351.5 L 638.0 358.4 L 638.0 366.6 L 634.1 367.7 L 635.4 373.5 L 644.5 373.5 L 647.1 375.8 L 648.4 380.5 L 652.3 382.8 L 653.6 390.9 L 653.6 384.0 L 656.2 381.6 L 666.7 382.8 L 666.7 392.1 L 661.5 393.2 L 670.6 393.2 L 677.1 395.6 L 677.1 403.7 L 671.9 404.8 L 673.2 410.6 L 697.9 409.5 L 704.4 411.8 L 730.5 414.1 L 730.5 411.8 L 737.0 407.2 L 735.7 392.1 L 733.1 390.9 L 733.1 384.0 L 735.7 381.6 L 730.5 381.6 L 727.9 378.2 L 729.2 367.7 L 724.0 367.7 L 721.4 371.2 L 704.4 371.2 L 700.5 367.7 L 700.5 361.9 L 682.3 363.1 L 681.0 361.9 L 681.0 345.7 L 682.3 344.5 L 681.0 342.2 L 677.1 348.0 L 675.8 351.5 L 666.7 351.5 L 665.4 349.2 L 658.9 349.2 L 653.6 341.0 L 639.3 339.9 L 638.0 336.4 L 632.8 336.4 Z",
        center: [685.5, 379.2],
        short: "Jizzax"
    },
    "Sirdaryo viloyati": {
        path: "M 734.4 319.0 L 731.8 322.5 L 731.8 331.8 L 735.7 334.1 L 735.7 341.0 L 734.4 342.2 L 721.4 342.2 L 718.8 341.0 L 713.5 344.5 L 708.3 351.5 L 708.3 357.3 L 703.1 363.1 L 703.1 367.7 L 704.4 368.9 L 718.8 368.9 L 721.4 366.6 L 729.2 366.6 L 730.5 367.7 L 730.5 378.2 L 731.8 379.3 L 731.8 388.6 L 733.1 389.8 L 737.0 389.8 L 739.6 387.4 L 748.7 387.4 L 750.0 389.8 L 752.6 390.9 L 753.9 388.6 L 750.0 385.1 L 750.0 378.2 L 751.3 377.0 L 763.0 377.0 L 765.6 379.3 L 765.6 381.6 L 785.2 381.6 L 785.2 379.3 L 789.1 378.2 L 781.2 378.2 L 779.9 375.8 L 778.6 378.2 L 764.3 378.2 L 759.1 375.8 L 759.1 367.7 L 761.7 366.6 L 761.7 360.8 L 764.3 356.1 L 764.3 346.8 L 760.4 341.0 L 737.0 321.3 L 737.0 317.8 Z",
        center: [739.3, 357.5],
        short: "Sirdaryo"
    },
    "Toshkent viloyati": {
        path: "M 872.4 220.4 L 864.6 218.1 L 851.6 223.9 L 846.4 234.3 L 830.7 235.5 L 811.2 257.5 L 791.7 264.5 L 774.7 280.7 L 760.4 284.2 L 756.5 300.4 L 731.8 320.2 L 738.3 320.2 L 764.3 344.5 L 761.7 366.6 L 724.0 366.6 L 716.1 370.0 L 729.2 371.2 L 730.5 397.9 L 735.7 399.0 L 731.8 411.8 L 704.4 413.0 L 678.4 408.3 L 679.7 399.0 L 665.4 393.2 L 665.4 381.6 L 648.4 380.5 L 645.8 373.5 L 638.0 370.0 L 632.8 341.0 L 652.3 338.7 L 641.9 338.7 L 627.6 329.4 L 632.8 371.2 L 645.8 377.0 L 656.2 395.6 L 671.9 396.7 L 671.9 415.3 L 681.0 411.8 L 730.5 415.3 L 738.3 406.0 L 738.3 394.4 L 753.9 390.9 L 756.5 382.8 L 800.8 382.8 L 802.1 377.0 L 781.2 377.0 L 777.3 373.5 L 776.0 329.4 L 787.8 328.3 L 799.5 335.2 L 835.9 310.9 L 845.1 310.9 L 835.9 291.2 L 835.9 283.0 L 843.8 277.2 L 828.1 276.1 L 826.8 265.6 L 846.4 245.9 L 855.5 243.6 L 859.4 234.3 L 877.6 227.4 Z",
        center: [781.9, 313.6],
        short: "Toshkent v."
    },
    "Namangan viloyati": {
        path: "M 938.8 286.5 L 933.6 286.5 L 931.0 288.8 L 923.2 288.8 L 920.6 286.5 L 920.6 278.4 L 918.0 277.2 L 915.4 273.8 L 912.8 273.8 L 908.9 271.4 L 908.9 268.0 L 906.2 264.5 L 903.6 266.8 L 904.9 270.3 L 904.9 280.7 L 903.6 281.9 L 895.8 281.9 L 895.8 294.6 L 894.5 295.8 L 886.7 295.8 L 884.1 293.5 L 881.5 294.6 L 859.4 293.5 L 856.8 291.2 L 856.8 284.2 L 854.2 280.7 L 854.2 276.1 L 849.0 276.1 L 845.1 277.2 L 841.1 280.7 L 838.5 280.7 L 835.9 287.7 L 843.8 299.3 L 843.8 306.2 L 842.4 307.4 L 851.6 315.5 L 851.6 321.3 L 854.2 324.8 L 862.0 326.0 L 865.9 323.6 L 882.8 323.6 L 885.4 324.8 L 886.7 327.1 L 893.2 327.1 L 897.1 326.0 L 903.6 320.2 L 907.6 312.0 L 910.2 309.7 L 931.0 309.7 L 937.5 307.4 L 940.1 305.1 Z",
        center: [887.5, 301.3],
        short: "Namangan"
    },
    "Andijon viloyati": {
        path: "M 998.7 306.2 L 972.7 306.2 L 970.1 303.9 L 967.4 303.9 L 966.1 302.8 L 959.6 302.8 L 957.0 298.1 L 955.7 298.1 L 953.1 295.8 L 953.1 294.6 L 950.5 294.6 L 949.2 298.1 L 946.6 300.4 L 941.4 300.4 L 941.4 305.1 L 937.5 308.6 L 932.3 309.7 L 931.0 310.9 L 916.7 310.9 L 915.4 309.7 L 915.4 305.1 L 914.1 305.1 L 914.1 309.7 L 912.8 310.9 L 907.6 312.0 L 907.6 315.5 L 904.9 320.2 L 899.7 324.8 L 903.6 321.3 L 915.4 321.3 L 916.7 322.5 L 925.8 322.5 L 927.1 323.6 L 932.3 323.6 L 936.2 327.1 L 941.4 329.4 L 947.9 330.6 L 950.5 332.9 L 950.5 337.6 L 951.8 339.9 L 954.4 342.2 L 958.3 342.2 L 959.6 339.9 L 959.6 331.8 L 960.9 330.6 L 971.4 330.6 L 971.4 328.3 L 972.7 327.1 L 976.6 327.1 L 977.9 326.0 L 977.9 321.3 L 979.2 319.0 L 985.7 315.5 L 988.3 315.5 L 994.8 310.9 L 998.7 310.9 Z",
        center: [952.4, 316.5],
        short: "Andijon"
    },
    "Farg'ona viloyati": {
        path: "M 837.2 348.0 L 843.8 352.6 L 849.0 352.6 L 851.6 355.0 L 852.9 357.3 L 852.9 360.8 L 854.2 361.9 L 858.1 360.8 L 863.3 360.8 L 864.6 359.6 L 871.1 358.4 L 877.6 355.0 L 882.8 355.0 L 884.1 353.8 L 888.0 353.8 L 889.3 352.6 L 897.1 352.6 L 907.6 357.3 L 916.7 357.3 L 918.0 358.4 L 918.0 360.8 L 933.6 349.2 L 933.6 348.0 L 938.8 343.4 L 938.8 339.9 L 942.7 337.6 L 949.2 337.6 L 949.2 334.1 L 925.8 323.6 L 902.3 323.6 L 895.8 328.3 L 886.7 328.3 L 884.1 326.0 L 881.5 326.0 L 878.9 323.6 L 877.6 324.8 L 867.2 324.8 L 864.6 327.1 L 856.8 330.6 L 851.6 331.8 L 849.0 339.9 L 843.8 342.2 L 841.1 345.7 L 838.5 345.7 Z",
        center: [892.9, 341.2],
        short: "Farg'ona"
    },
    "Qashqadaryo viloyati": {
        path: "M 471.4 459.4 L 487.0 460.5 L 503.9 475.6 L 526.0 483.7 L 561.2 509.2 L 585.9 508.1 L 604.2 518.5 L 621.1 522.0 L 622.4 533.6 L 625.0 530.1 L 623.7 517.4 L 639.3 516.2 L 644.5 511.6 L 644.5 500.0 L 652.3 498.8 L 653.6 494.2 L 657.6 491.8 L 657.6 482.6 L 669.3 480.2 L 671.9 468.6 L 686.2 467.5 L 686.2 454.7 L 701.8 454.7 L 686.2 454.7 L 683.6 444.3 L 673.2 443.1 L 668.0 439.6 L 669.3 421.1 L 666.7 430.4 L 649.7 429.2 L 647.1 432.7 L 639.3 432.7 L 623.7 425.7 L 618.5 428.0 L 615.9 433.8 L 591.1 429.2 L 585.9 435.0 L 578.1 435.0 L 570.3 423.4 L 553.4 426.9 L 529.9 425.7 L 524.7 422.2 L 523.4 413.0 L 520.8 419.9 L 526.0 424.6 L 526.0 431.5 L 514.3 438.5 L 513.0 447.8 L 509.1 451.2 L 496.1 451.2 L 480.5 460.5 Z",
        center: [592.2, 467.2],
        short: "Qashqadaryo"
    },
    "Surxondaryo viloyati": {
        path: "M 708.3 453.6 L 701.8 455.9 L 683.6 454.7 L 681.0 457.0 L 682.3 466.3 L 671.9 467.5 L 670.6 480.2 L 666.7 482.6 L 657.6 482.6 L 657.6 491.8 L 654.9 494.2 L 654.9 497.6 L 652.3 500.0 L 645.8 500.0 L 644.5 502.3 L 644.5 512.7 L 640.6 516.2 L 627.6 516.2 L 622.4 518.5 L 621.1 520.8 L 625.0 524.3 L 625.0 532.4 L 619.8 537.1 L 618.5 546.4 L 618.5 566.1 L 619.8 567.2 L 623.7 567.2 L 627.6 569.6 L 640.6 566.1 L 652.3 566.1 L 654.9 570.7 L 661.5 575.4 L 661.5 578.8 L 683.6 578.8 L 684.9 574.2 L 694.0 574.2 L 696.6 578.8 L 699.2 564.9 L 699.2 552.2 L 710.9 538.2 L 713.5 526.6 L 724.0 522.0 L 729.2 506.9 L 717.4 498.8 L 712.2 488.4 L 708.3 484.9 L 708.3 467.5 L 714.8 464.0 Z",
        center: [674.4, 522.8],
        short: "Surxondaryo"
    },
    "Toshkent shahri": {
        path: null,
        center: [749.0, 287.7],
        short: "Toshkent sh."
    }
};

const CRIME_COLORS = {
    "bosqinchilik":            "#ef4444",
    "firibgarlik":             "#a78bfa",
    "giyohvandlik":            "#34d399",
    "nomusga tegish":          "#f472b6",
    "o'g'irlik":               "#fbbf24",
    "qastdan odam o'ldirish":  "#dc2626",
    "tan jaroxati":            "#fb923c",
    "tovlamachilik":           "#06b6d4"
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ============================================================
 * MAP — pan + zoom state.
 * The geo content (#uz-zoom-target) is transformed by
 * `translate(tx ty) scale(scale)`.  Markers live outside that
 * group; their per-region <g> wrappers get a translate-only
 * transform recomputed from the same state, so the circles
 * follow the map but don't grow when the user zooms in.
 * ============================================================ */
const MAP_VB = { w: 1000, h: 580 };
const ZOOM_LIMITS = { min: 1, max: 6 };
const mapZoom = { scale: 1, tx: 0, ty: 0 };

function clampZoomState() {
    mapZoom.scale = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, mapZoom.scale));
    // Keep the map from being dragged completely off-screen.
    const minTx = MAP_VB.w * (1 - mapZoom.scale);
    const minTy = MAP_VB.h * (1 - mapZoom.scale);
    mapZoom.tx = Math.max(minTx, Math.min(0, mapZoom.tx));
    mapZoom.ty = Math.max(minTy, Math.min(0, mapZoom.ty));
}

function screenTransform(wx, wy) {
    // World point -> screen point (viewBox coords) using the current zoom.
    const sx = wx * mapZoom.scale + mapZoom.tx;
    const sy = wy * mapZoom.scale + mapZoom.ty;
    return `translate(${sx} ${sy})`;
}

function applyMapTransform() {
    const target = document.getElementById('uz-zoom-target');
    if (target) {
        target.setAttribute('transform',
            `translate(${mapZoom.tx} ${mapZoom.ty}) scale(${mapZoom.scale})`);
    }
    // Reposition every marker group (translate-only; their children use 0,0).
    document.querySelectorAll('.uz-region-marker').forEach(g => {
        const wx = parseFloat(g.getAttribute('data-wx'));
        const wy = parseFloat(g.getAttribute('data-wy'));
        if (!isNaN(wx) && !isNaN(wy)) {
            g.setAttribute('transform', screenTransform(wx, wy));
        }
    });
}

function zoomAt(vbX, vbY, factor) {
    const newScale = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, mapZoom.scale * factor));
    if (newScale === mapZoom.scale) return;
    // Anchor the zoom so that the world point currently under (vbX, vbY)
    // stays under the same screen position after scaling.
    const worldX = (vbX - mapZoom.tx) / mapZoom.scale;
    const worldY = (vbY - mapZoom.ty) / mapZoom.scale;
    mapZoom.scale = newScale;
    mapZoom.tx = vbX - worldX * newScale;
    mapZoom.ty = vbY - worldY * newScale;
    clampZoomState();
    applyMapTransform();
}

function resetZoom() {
    mapZoom.scale = 1;
    mapZoom.tx = 0;
    mapZoom.ty = 0;
    applyMapTransform();
}

function setupMapZoom() {
    const svg = document.getElementById('uzMap');
    if (!svg) return;

    function clientToVb(clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (MAP_VB.w / rect.width),
            y: (clientY - rect.top)  * (MAP_VB.h / rect.height),
        };
    }

    // Wheel zoom (anchored at cursor)
    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const { x, y } = clientToVb(e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        zoomAt(x, y, factor);
    }, { passive: false });

    // Drag-to-pan.  IMPORTANT: we deliberately do NOT call
    // setPointerCapture here.  Capturing on pointerdown re-routes the
    // synthesized click event to the SVG instead of the region polygon
    // underneath, which kills the slicer-style click-to-filter behaviour.
    // Instead we listen for pointermove/pointerup on the document so a
    // drag still works even when the cursor briefly leaves the SVG.
    let dragOrigin = null;
    let didPan = false;
    let panStartZoom = null;
    const PAN_THRESHOLD_SQ = 36;   // ~6px before we treat motion as a pan

    svg.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        dragOrigin = { x: e.clientX, y: e.clientY };
        panStartZoom = { tx: mapZoom.tx, ty: mapZoom.ty };
        didPan = false;
    });

    function onPointerMove(e) {
        if (!dragOrigin) return;
        const dx = e.clientX - dragOrigin.x;
        const dy = e.clientY - dragOrigin.y;
        if (!didPan && (dx * dx + dy * dy) > PAN_THRESHOLD_SQ) {
            didPan = true;
            svg.classList.add('panning');
        }
        if (didPan) {
            const rect = svg.getBoundingClientRect();
            mapZoom.tx = panStartZoom.tx + dx * (MAP_VB.w / rect.width);
            mapZoom.ty = panStartZoom.ty + dy * (MAP_VB.h / rect.height);
            clampZoomState();
            applyMapTransform();
        }
    }

    function onPointerUp() {
        if (!dragOrigin) return;
        dragOrigin = null;
        svg.classList.remove('panning');
        if (didPan) {
            // Suppress the click that the browser is about to fire after
            // this drag, otherwise it would select a random region.
            const block = (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                svg.removeEventListener('click', block, true);
            };
            svg.addEventListener('click', block, true);
            // Safety: drop the blocker if the click never comes.
            setTimeout(() => svg.removeEventListener('click', block, true), 120);
        }
        didPan = false;
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    // Buttons
    document.getElementById('mapZoomIn')
        ?.addEventListener('click', () => zoomAt(MAP_VB.w / 2, MAP_VB.h / 2, 1.4));
    document.getElementById('mapZoomOut')
        ?.addEventListener('click', () => zoomAt(MAP_VB.w / 2, MAP_VB.h / 2, 1 / 1.4));
    document.getElementById('mapReset')
        ?.addEventListener('click', resetZoom);
}

// Session ID -suhbat xotirasini boshqarish uchun
function getSessionId() {
    let sid = localStorage.getItem('jaai_session_id');
    if (!sid) {
        sid = 'session_' + Math.random().toString(36).slice(2) + Date.now();
        localStorage.setItem('jaai_session_id', sid);
    }
    return sid;
}

document.addEventListener('DOMContentLoaded', async () => {
    initCustomSelects();
    setupTooltip();
    await loadData();
    setupEventListeners();
});

/* ============================================================
 * CUSTOM SELECT (theme-matched dropdown)
 * ============================================================ */
function CustomSelect(rootEl, onChange) {
    let options = [];
    let value = null;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
        <span class="cs-value"></span>
        <svg class="cs-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    `;

    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    menu.setAttribute('role', 'listbox');

    rootEl.classList.add('cs-mount');
    rootEl.appendChild(trigger);
    rootEl.appendChild(menu);

    function buildDot(color) {
        if (!color) return null;
        const dot = document.createElement('span');
        dot.className = 'cs-dot';
        // Accept solid colors and CSS gradients (used for the "All" option).
        dot.style.background = color;
        return dot;
    }

    function render() {
        const valueEl = trigger.querySelector('.cs-value');
        const cur = options.find(o => o.value === value);
        valueEl.innerHTML = '';
        if (cur) {
            const dot = buildDot(cur.color);
            if (dot) valueEl.appendChild(dot);
            const txt = document.createElement('span');
            txt.className = 'cs-value-text';
            txt.textContent = cur.label;
            valueEl.appendChild(txt);
        }

        menu.innerHTML = '';
        options.forEach(o => {
            const item = document.createElement('div');
            item.className = 'cs-option' + (o.value === value ? ' selected' : '');
            item.dataset.value = o.value;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', o.value === value ? 'true' : 'false');
            const dot = buildDot(o.color);
            if (dot) item.appendChild(dot);
            const txt = document.createElement('span');
            txt.className = 'cs-option-text';
            txt.textContent = o.label;
            item.appendChild(txt);
            item.addEventListener('click', () => {
                value = o.value;
                close();
                render();
                onChange && onChange(value);
            });
            menu.appendChild(item);
        });
    }

    function open() {
        rootEl.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('keydown', onKey);
    }
    function close() {
        rootEl.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onOutside);
        document.removeEventListener('keydown', onKey);
    }
    function onOutside(e) {
        if (!rootEl.contains(e.target)) close();
    }
    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    trigger.addEventListener('click', () => {
        rootEl.classList.contains('open') ? close() : open();
    });

    return {
        setOptions(opts, defaultValue) {
            options = opts;
            if (defaultValue !== undefined) value = defaultValue;
            else if (value === null && opts.length) value = opts[0].value;
            render();
        },
        setValue(v) { value = v; render(); },
        getValue() { return value; },
    };
}

function initCustomSelects() {
    regionSelect = CustomSelect(document.getElementById('regionSelect'), () => renderTable());
    crimeSelect  = CustomSelect(document.getElementById('crimeSelect'),  () => renderTable());

    // Boshlang'ich qiymatlar (data yuklanmagunga qadar)
    regionSelect.setOptions([{ value: 'All', label: "Barchasi (O'zbekiston)" }], 'All');
    crimeSelect.setOptions([{ value: 'All', label: 'Barchasi' }], 'All');
}

/* ============================================================
 * CUSTOM TOOLTIP (theme-matched, follows cursor)
 * ============================================================ */
let tooltipEl = null;
function setupTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'jaai-tooltip';
    document.body.appendChild(tooltipEl);
}
function showTooltip(e, title, body) {
    if (!tooltipEl) setupTooltip();
    tooltipEl.innerHTML = `<div class="jaai-tooltip-title">${escapeHtml(title)}</div>${escapeHtml(body)}`;
    tooltipEl.classList.add('visible');
    positionTooltip(e);
}
function positionTooltip(e) {
    if (!tooltipEl) return;
    const offsetX = 16, offsetY = 18;
    const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;
    if (x + tw + 8 > window.innerWidth)  x = e.clientX - tw - offsetX;
    if (y + th + 8 > window.innerHeight) y = e.clientY - th - offsetY;
    tooltipEl.style.left = Math.max(8, x) + 'px';
    tooltipEl.style.top  = Math.max(8, y) + 'px';
}
function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/* ============================================================
 * DATA + TABLE
 * ============================================================ */
async function loadData() {
    try {
        const response = await fetch('/api/data');
        const json = await response.json();
        globalData = json.data;

        populateFilters();
        buildMap();
        setupMapZoom();
        renderTable();
    } catch (e) {
        console.error("Error loading data:", e);
        document.getElementById('tableSummary').innerText = "Ma'lumotlarni yuklashda xatolik yuz berdi.";
    }
}

function populateFilters() {
    const regions = new Set();
    const crimes = new Set();
    globalData.forEach(item => {
        regions.add(item.region);
        crimes.add(item.crime_type);
    });

    const regionOpts = [{ value: 'All', label: "Barchasi (O'zbekiston)" }];
    [...regions].sort().forEach(r => {
        if (r !== "O'zbekiston Respublikasi" && r !== "O‘zbekiston Respublikasi") {
            regionOpts.push({ value: r, label: r });
        }
    });
    regionSelect.setOptions(regionOpts, 'All');

    const allGradient = 'linear-gradient(135deg, #ef4444, #fbbf24, #34d399, #06b6d4, #a78bfa)';
    const crimeOpts = [{ value: 'All', label: 'Barchasi', color: allGradient }];
    [...crimes].sort().forEach(c => crimeOpts.push({
        value: c,
        label: c,
        color: CRIME_COLORS[c] || 'var(--accent)'
    }));
    crimeSelect.setOptions(crimeOpts, 'All');
}

function getSelectedFilters() {
    return {
        region: regionSelect ? regionSelect.getValue() : 'All',
        crime_type: crimeSelect ? crimeSelect.getValue() : 'All',
    };
}

function renderTable() {
    const { region, crime_type } = getSelectedFilters();
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    let filteredData = globalData;
    if (region !== 'All')     filteredData = filteredData.filter(d => d.region === region);
    if (crime_type !== 'All') filteredData = filteredData.filter(d => d.crime_type === crime_type);

    document.getElementById('tableSummary').innerText = `Jami topilgan natijalar: ${filteredData.length} ta`;

    const fmt = (num) => (num || num === 0) ? Number(num).toLocaleString() : '-';

    filteredData.forEach(item => {
        const tr = document.createElement('tr');

        const hist = item.history;
        const trend = item.prediction.probability_trend;
        let trendClass = 'trend-stable';
        let trendText = 'Barqaror';
        if (trend === 'increase')      { trendClass = 'trend-increase'; trendText = "O'sish ↗"; }
        else if (trend === 'decrease') { trendClass = 'trend-decrease'; trendText = 'Kamayish ↘'; }

        tr.innerHTML = `
            <td>${escapeHtml(item.region)}</td>
            <td>${escapeHtml(item.crime_type)}</td>
            <td>${fmt(hist['2021'])}</td>
            <td>${fmt(hist['2022'])}</td>
            <td>${fmt(hist['2023'])}</td>
            <td>${fmt(hist['2024'])}</td>
            <td>${fmt(hist['2025'])}</td>
            <td class="highlight-col">${fmt(item.prediction.expected_count_2026)}</td>
            <td><span class="trend-badge ${trendClass}">${trendText}</span></td>
        `;

        // Custom theme tooltip (native title o'rnida)
        const reasoning = item.prediction.reasoning || '';
        if (reasoning) {
            tr.addEventListener('mouseenter', (e) => showTooltip(e, 'Prognoz asosi', reasoning));
            tr.addEventListener('mousemove', positionTooltip);
            tr.addEventListener('mouseleave', hideTooltip);
        }

        tbody.appendChild(tr);
    });

    renderMap();
}

/* ============================================================
 * MAP — build (once) and render (on every filter change)
 * ============================================================ */
function buildMap() {
    if (mapBuilt) return;
    const svg = document.getElementById('uzMap');
    if (!svg) return;
    const regionsLayer = svg.querySelector('#uz-regions');
    const labelsLayer  = svg.querySelector('#uz-labels');
    if (!regionsLayer || !labelsLayer) return;

    // Country silhouette as the background fill (covers any cracks
    // between region polygons).
    const country = document.createElementNS(SVG_NS, 'path');
    country.setAttribute('class', 'uz-country-bg');
    country.setAttribute('d', COUNTRY_OUTLINE);
    regionsLayer.appendChild(country);

    // Per-region polygons.  These carry the hover/click handlers so
    // clicking anywhere inside a viloyat selects it.
    Object.entries(REGIONS).forEach(([rname, geo]) => {
        if (!geo.path) return;
        const region = document.createElementNS(SVG_NS, 'path');
        region.setAttribute('class', 'uz-region');
        region.setAttribute('data-region', rname);
        region.setAttribute('d', geo.path);
        region.addEventListener('mouseenter', (e) =>
            showTooltip(e, rname, 'Bosing — shu hududni tanlash'));
        region.addEventListener('mousemove', positionTooltip);
        region.addEventListener('mouseleave', hideTooltip);
        region.addEventListener('click', () => onRegionClick(rname));
        regionsLayer.appendChild(region);
    });

    // Country border on top, so the silhouette stays crisp
    // even where region polygons have ragged edges.
    const border = document.createElementNS(SVG_NS, 'path');
    border.setAttribute('class', 'uz-country-border');
    border.setAttribute('d', COUNTRY_OUTLINE);
    regionsLayer.appendChild(border);

    // Labels are re-rendered each render() so they can track the
    // current marker radius and stay just outside it.

    mapBuilt = true;
}

function renderMap() {
    if (!mapBuilt) return;
    const filters = getSelectedFilters();
    const titleEl = document.getElementById('mapTitleText');
    const subEl   = document.getElementById('mapSubtitle');

    // Aggregate 2026 prediction counts per region & crime type.
    const perRegionByType = {};
    globalData.forEach(item => {
        if (item.region === "O'zbekiston Respublikasi" || item.region === "O‘zbekiston Respublikasi") return;
        if (!perRegionByType[item.region]) perRegionByType[item.region] = {};
        perRegionByType[item.region][item.crime_type] =
            Number(item.prediction.expected_count_2026) || 0;
    });

    const totalForRegion = (rname) => {
        const m = perRegionByType[rname] || {};
        if (filters.crime_type === 'All') {
            return Object.values(m).reduce((a, b) => a + b, 0);
        }
        return m[filters.crime_type] || 0;
    };

    // Pull totals across all regions to compute the radius scale.
    let maxCount = 0;
    Object.keys(REGIONS).forEach(rname => {
        const c = totalForRegion(rname);
        if (c > maxCount) maxCount = c;
    });
    if (maxCount <= 0) maxCount = 1;

    const minR = 12;
    const maxR = 62;
    const radiusFor = (count) => {
        if (!count || count <= 0) return 0;
        return Math.sqrt(count / maxCount) * (maxR - minR) + minR;
    };

    // Choropleth: color each region polygon by intensity, plus dim/select.
    const baseColor = filters.crime_type === 'All'
        ? '#4dd0e1'
        : (CRIME_COLORS[filters.crime_type] || '#4dd0e1');
    document.querySelectorAll('.uz-region').forEach(poly => {
        const rname = poly.getAttribute('data-region');
        const c = totalForRegion(rname);
        const intensity = c / maxCount;
        // 0 -> 0.05 alpha, 1 -> 0.55 alpha (eye-friendly range)
        const alpha = 0.05 + 0.5 * intensity;
        poly.style.fill = hexWithAlpha(baseColor, alpha);

        poly.classList.remove('selected', 'dimmed');
        if (filters.region === 'All') {
            // default state
        } else if (filters.region === rname) {
            poly.classList.add('selected');
        } else {
            poly.classList.add('dimmed');
        }
    });

    // Re-render labels — placed just below each marker so big circles
    // don't swallow them.  The actual radius for this region is computed
    // below in the marker pass; we cache it here.
    const labelsLayer = document.getElementById('uz-labels');
    if (labelsLayer) {
        while (labelsLayer.firstChild) labelsLayer.removeChild(labelsLayer.firstChild);
        Object.entries(REGIONS).forEach(([rname, geo]) => {
            const r = radiusFor(totalForRegion(rname));
            const dimmed = filters.region !== 'All' && filters.region !== rname;
            const isSel = filters.region === rname;
            const lbl = document.createElementNS(SVG_NS, 'text');
            let cls = 'uz-label';
            if (isSel) cls += ' selected';
            if (dimmed) cls += ' dimmed';
            lbl.setAttribute('class', cls);
            lbl.setAttribute('data-region', rname);
            lbl.setAttribute('x', geo.center[0]);
            // Push label below the marker (with padding) so big circles
            // don't cover the text.
            const labelY = geo.center[1] + (r > 0 ? r + 13 : 6);
            lbl.setAttribute('y', labelY);
            lbl.setAttribute('text-anchor', 'middle');
            lbl.textContent = geo.short;
            labelsLayer.appendChild(lbl);
        });
    }

    // Re-render markers layer from scratch.
    const markersLayer = document.getElementById('uz-markers');
    if (!markersLayer) return;
    while (markersLayer.firstChild) markersLayer.removeChild(markersLayer.firstChild);

    // Find the highest-count region (for pulse).
    let topRegion = null, topCount = 0;
    Object.keys(REGIONS).forEach(rname => {
        const c = totalForRegion(rname);
        if (c > topCount) { topCount = c; topRegion = rname; }
    });

    Object.entries(REGIONS).forEach(([rname, geo], idx) => {
        const total = totalForRegion(rname);
        const r = radiusFor(total);
        if (r <= 0) return;

        const dimmed = filters.region !== 'All' && filters.region !== rname;
        const isSelected = filters.region === rname;
        const [wx, wy] = geo.center;
        const breakdown = perRegionByType[rname] || {};

        // Wrap every visual for this region in a single <g>.  The group's
        // transform translates to the (zoom-aware) screen position; all
        // children draw from origin (0, 0).  This keeps the markers a
        // constant on-screen size as the user zooms in/out.
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'uz-region-marker');
        g.setAttribute('data-region', rname);
        g.setAttribute('data-wx', wx);
        g.setAttribute('data-wy', wy);
        g.setAttribute('transform', screenTransform(wx, wy));
        markersLayer.appendChild(g);

        // Pulse ring on the largest region (only when not dimmed).
        if (rname === topRegion && !dimmed) {
            const pulse = document.createElementNS(SVG_NS, 'circle');
            pulse.setAttribute('class', 'uz-pulse');
            pulse.setAttribute('cx', 0);
            pulse.setAttribute('cy', 0);
            pulse.setAttribute('r', r);
            g.appendChild(pulse);
        }

        // Selection halo around the chosen region.
        if (isSelected) {
            const halo = document.createElementNS(SVG_NS, 'circle');
            halo.setAttribute('class', 'uz-select-halo');
            halo.setAttribute('cx', 0);
            halo.setAttribute('cy', 0);
            halo.setAttribute('r', r + 5);
            g.appendChild(halo);
        }

        if (filters.crime_type === 'All') {
            // Multi-color pie: each crime type contributes a wedge.
            const slices = Object.entries(breakdown)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1]);
            const sum = slices.reduce((a, [, v]) => a + v, 0);

            if (sum === 0) return;

            let startAngle = -Math.PI / 2;
            slices.forEach(([crime, v], i) => {
                const arc = (v / sum) * Math.PI * 2;
                const endAngle = startAngle + arc;
                const slice = document.createElementNS(SVG_NS, 'path');
                slice.setAttribute('d', pieSlicePath(0, 0, r, startAngle, endAngle));
                slice.setAttribute('fill', CRIME_COLORS[crime] || 'var(--accent)');
                slice.setAttribute('class', 'uz-marker' + (dimmed ? ' dimmed' : ''));
                slice.setAttribute('data-region', rname);
                slice.setAttribute('data-crime', crime);
                slice.style.animationDelay = (idx * 0.025 + i * 0.015) + 's';
                slice.addEventListener('mouseenter', (e) =>
                    showTooltip(e, `${rname} — ${crime}`, `${v.toLocaleString()} ta (2026)`));
                slice.addEventListener('mousemove', positionTooltip);
                slice.addEventListener('mouseleave', hideTooltip);
                slice.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (crimeSelect) crimeSelect.setValue(crime);
                    onRegionClick(rname);
                });
                g.appendChild(slice);
                startAngle = endAngle;
            });

            // Outer ring on top of slices for a clean edge.
            const ring = document.createElementNS(SVG_NS, 'circle');
            ring.setAttribute('class', 'uz-marker-ring' + (dimmed ? ' dimmed' : ''));
            ring.setAttribute('cx', 0);
            ring.setAttribute('cy', 0);
            ring.setAttribute('r', r);
            g.appendChild(ring);
        } else {
            // Single solid colored circle for the chosen crime type.
            const color = CRIME_COLORS[filters.crime_type] || 'var(--accent)';
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('class', 'uz-marker' + (dimmed ? ' dimmed' : ''));
            circle.setAttribute('cx', 0);
            circle.setAttribute('cy', 0);
            circle.setAttribute('r', r);
            circle.setAttribute('fill', color);
            circle.setAttribute('data-region', rname);
            circle.style.animationDelay = (idx * 0.025) + 's';
            circle.addEventListener('mouseenter', (e) =>
                showTooltip(e, `${rname} — ${filters.crime_type}`, `${total.toLocaleString()} ta (2026)`));
            circle.addEventListener('mousemove', positionTooltip);
            circle.addEventListener('mouseleave', hideTooltip);
            circle.addEventListener('click', (e) => {
                e.stopPropagation();
                onRegionClick(rname);
            });
            g.appendChild(circle);
        }

        // Count label inside the circle, scaled with radius.
        const txt = document.createElementNS(SVG_NS, 'text');
        let sizeClass = '';
        if (r < 16)        sizeClass = ' small';
        else if (r < 28)   sizeClass = '';
        else if (r < 44)   sizeClass = ' large';
        else               sizeClass = ' xlarge';
        txt.setAttribute('class', 'uz-count' + sizeClass + (dimmed ? ' dimmed' : ''));
        txt.setAttribute('x', 0);
        const yOffset = r >= 44 ? 6 : r >= 28 ? 4.5 : 3.5;
        txt.setAttribute('y', yOffset);
        txt.setAttribute('text-anchor', 'middle');
        txt.textContent = formatCount(total);
        g.appendChild(txt);
    });

    // Title + subtitle reflect the current selection.
    if (titleEl && subEl) {
        if (filters.region !== 'All') {
            titleEl.textContent = filters.region + ' · 2026';
        } else {
            titleEl.textContent = "O'zbekiston · 2026 prognozi";
        }
        subEl.textContent = filters.crime_type === 'All'
            ? 'barcha turlar'
            : filters.crime_type;
    }
}

function hexWithAlpha(hex, alpha) {
    // Accepts "#rrggbb" and returns "rgba(r, g, b, alpha)".
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 0xff;
    const g = (n >>  8) & 0xff;
    const b =  n        & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function pieSlicePath(cx, cy, r, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function formatCount(n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
    if (n >= 1000)  return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function onRegionClick(rname) {
    if (!regionSelect) return;
    const next = regionSelect.getValue() === rname ? 'All' : rname;
    regionSelect.setValue(next);
    renderTable();
}

/* ============================================================
 * CHAT
 * ============================================================ */
function setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    const sendMessage = async () => {
        const msg = chatInput.value.trim();
        if (!msg) return;

        appendMessage('user', msg);
        chatInput.value = '';
        setAIState(true);

        const aiDiv = createStreamingBubble();

        try {
            const context = getSelectedFilters();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context, session_id: getSessionId() })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullText = '';
            let done = false;

            while (!done) {
                const r = await reader.read();
                if (r.done) break;

                buffer += decoder.decode(r.value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') { done = true; break; }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            aiDiv.innerText = `Xatolik: ${parsed.error}`;
                        } else if (parsed.token) {
                            fullText += parsed.token;
                            aiDiv.innerText = fullText;
                            const container = document.getElementById('chatContainer');
                            container.scrollTop = container.scrollHeight;
                        }
                    } catch(e) { /* ignore parse errors */ }
                }
            }
            aiDiv.classList.remove('streaming');
        } catch (e) {
            aiDiv.innerText = 'Kechirasiz, aloqada xatolik yuz berdi.';
        } finally {
            setAIState(false);
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('clearChatBtn').addEventListener('click', async () => {
        const sid = getSessionId();
        await fetch(`/api/chat/history/${sid}`, { method: 'DELETE' });
        localStorage.removeItem('jaai_session_id');
        const container = document.getElementById('chatContainer');
        container.innerHTML = `
            <div class="message ai">
                <p>Salom! Yangi suhbat boshlandi. Savollaringiz bormi?</p>
            </div>`;
    });
}

function appendMessage(role, text) {
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function createStreamingBubble() {
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = 'message ai streaming';
    div.innerText = '';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

function setAIState(isThinking) {
    const orb = document.getElementById('aiOrb');
    const statusText = document.querySelector('.ai-status');
    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');

    if (isThinking) {
        orb && orb.classList.add('thinking');
        statusText.innerText = "O'ylamoqda...";
        statusText.style.color = 'var(--trend-stable)';
        sendBtn.disabled = true;
        chatInput.disabled = true;
    } else {
        orb && orb.classList.remove('thinking');
        statusText.innerText = 'Online';
        statusText.style.color = 'var(--trend-down)';
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}
