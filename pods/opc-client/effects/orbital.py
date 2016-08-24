import math
import random
import numpy
from effectlayer import *

class OrbitalLayer(EffectLayer):

    def __init__(self, hueSpeed=0.00003, saturationSpeed=0.0005, orbital_period=1.0, radius_period=1.0, rotation_direction=1.0, r1_period=1.0):
        self.hueSpeed = hueSpeed
        self.saturationSpeed = saturationSpeed
        self.orbital_period = orbital_period
        self.radius_period = radius_period
        self.rotation_direction = rotation_direction
        self.r1_period = r1_period
        self.hue = random.random()
        self.saturation = 1.0

    def render(self, model, params, frame):
        self.hue = self.increment(self.hue, self.hueSpeed)
        # self.saturation = self.increment(self.saturation, self.saturationSpeed)

        _2pi = 2.0 * math.pi
        t_center = ((params.time % self.orbital_period) / self.orbital_period) * _2pi
        x, y = math.cos(t_center), self.rotation_direction * math.sin(t_center)
        t_radius = 0.7#((params.time % self.radius_period) / self.radius_period) * _2pi
        radius = (math.sin(t_radius) + 1.0) / 2.0
        x = (x * radius + 1.0) / 2.0 # put [-1,1] into positive unit coord space
        y = (y * radius + 1.0) / 2.0
        t_r1 = ((params.time % self.r1_period) / self.r1_period) * _2pi
        r1 = 0.2 + ((math.sin(t_radius) + 1.0) / 2.0) / 2.0
        a1 = 3
        branches = [model.branch1Indices, model.branch2Indices, model.branch3Indices, model.branch4Indices]
        for idx1, branchIndices in enumerate(branches):
            x_norm = float(idx1) / (len(branches) - 1)
            for idx2, i in enumerate(branchIndices):
                y_norm = float(idx2) / (len(branchIndices) - 1)
                dist = math.sqrt((x_norm - x) ** 2 + (y_norm - y) ** 2)
                value = 1.0 / (dist / r1) ** a1
                frame[i] = numpy.array(colorsys.hsv_to_rgb(self.hue, self.saturation, value))

    def increment(self, value, step):
        value += step
        if value>1:
            value -= 1
        return value
