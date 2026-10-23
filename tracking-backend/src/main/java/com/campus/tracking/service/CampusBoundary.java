package com.campus.tracking.service;

/** Campus perimeter exported from the UCER Metashape boundary KML. */
public final class CampusBoundary {

    private static final double[][] POLYGON = {
        {25.3448576127, 81.9109565113},
        {25.3450834437, 81.9105708885},
        {25.3450912309, 81.9103138066},
        {25.3449899964, 81.9101338493},
        {25.3448809745, 81.9101766963},
        {25.3448498254, 81.9099453226},
        {25.3447485909, 81.9098167817},
        {25.3447174418, 81.9096282550},
        {25.3445928454, 81.9095168529},
        {25.3444604617, 81.9094740059},
        {25.3443911816, 81.9094304411},
        {25.3441143713, 81.9094250754},
        {25.3440565196, 81.9094144650},
        {25.3441432972, 81.9090908494},
        {25.3437817240, 81.9090377977},
        {25.3435069283, 81.9090324925},
        {25.3432707005, 81.9091492063},
        {25.3429573371, 81.9092977512},
        {25.3426584366, 81.9095258737},
        {25.3424366717, 81.9096797238},
        {25.3423016843, 81.9098123531},
        {25.3422679375, 81.9098229635},
        {25.3428657385, 81.9109052191},
        {25.3436033479, 81.9121519351},
        {25.3438369661, 81.9124604333},
        {25.3441406698, 81.9128203479},
        {25.3442964152, 81.9128289173},
        {25.3443587134, 81.9126575294},
        {25.3444599480, 81.9125289885},
        {25.3446312680, 81.9124775721},
        {25.3446546298, 81.9122719066},
        {25.3446546298, 81.9120919493},
        {25.3446546298, 81.9119719778},
        {25.3447169280, 81.9117148960},
        {25.3447636517, 81.9114920917},
        {25.3448103753, 81.9113892589},
        {25.3448570990, 81.9111835935}
    };

    private CampusBoundary() {
    }

    public static boolean contains(double latitude, double longitude) {
        boolean inside = false;
        int previous = POLYGON.length - 1;

        for (int current = 0; current < POLYGON.length; current++) {
            double currentLat = POLYGON[current][0];
            double currentLng = POLYGON[current][1];
            double previousLat = POLYGON[previous][0];
            double previousLng = POLYGON[previous][1];

            boolean crossesLatitude = (currentLat > latitude) != (previousLat > latitude);
            if (crossesLatitude) {
                double crossingLongitude = (previousLng - currentLng)
                    * (latitude - currentLat) / (previousLat - currentLat) + currentLng;
                if (longitude < crossingLongitude) {
                    inside = !inside;
                }
            }
            previous = current;
        }

        return inside;
    }
}
